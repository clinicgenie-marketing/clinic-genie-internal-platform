import { ACTIVE_TASK_STATUSES, type TaskPriority, type TaskStatus } from "@clinic-genie/contracts";
import type { Queryable } from "../client";
import { recordAudit } from "./audit";
import { isValidDate } from "./dates";
import { resolveRelated } from "./related";
import { recordTimeline } from "./timeline";

export interface TaskRow {
  id: string;
  client_id: string;
  client_name: string;
  client_slug: string;
  title: string;
  description: string | null;
  owner_user_id: string;
  owner_name: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  waiting_on: string | null;
  follow_up_date: string | null;
  related_type: string | null;
  related_id: string | null;
  related_title: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  cancelled_at: Date | null;
}

export interface TaskInput {
  clientId: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  priority: TaskPriority;
  dueDate: string | null;
  relatedType: string | null;
  relatedId: string | null;
}

export class TaskRuleError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "TaskRuleError";
  }
}

const TASK_SELECT = `
  select t.*, c.name as client_name, c.slug as client_slug, u.display_name as owner_name,
         case t.related_type
           when 'issue' then (select title from issues i where i.id = t.related_id)
           when 'approval' then (select title from approvals a where a.id = t.related_id)
           when 'seo_page' then (select page_path from seo_pages p where p.id = t.related_id)
           when 'ads_audit' then (select title from ads_audits a where a.id = t.related_id)
           when 'medical_claim' then (select claim_summary from medical_claims m where m.id = t.related_id)
           when 'ads_change' then (select description from ads_changes a where a.id = t.related_id)
           else null end as related_title
  from tasks t join clients c on c.id = t.client_id join staff_users u on u.id = t.owner_user_id`;

export interface TaskFilters {
  clientId?: string;
  ownerUserId?: string;
  statuses?: TaskStatus[];
  priority?: TaskPriority;
  limit?: number;
}

export async function listTasks(db: Queryable, f: TaskFilters = {}): Promise<TaskRow[]> {
  const statuses = f.statuses ?? ACTIVE_TASK_STATUSES;
  const { rows } = await db.query<TaskRow>(
    `${TASK_SELECT}
     where ($1::uuid is null or t.client_id = $1) and ($2::uuid is null or t.owner_user_id = $2)
       and t.status = any($3::text[]) and ($4::text is null or t.priority = $4)
     order by t.due_date asc nulls last, t.created_at asc limit $5`,
    [f.clientId ?? null, f.ownerUserId ?? null, statuses, f.priority ?? null, f.limit ?? 500],
  );
  return rows;
}

export async function getTask(db: Queryable, id: string) {
  const { rows } = await db.query<TaskRow>(`${TASK_SELECT} where t.id = $1`, [id]);
  const task = rows[0];
  if (!task) return null;
  const history = await db.query(
    `select h.*, a.display_name as actor_name, fo.display_name as from_owner_name, tu.display_name as to_owner_name
     from task_history h join staff_users a on a.id = h.actor_user_id
     left join staff_users fo on fo.id = h.from_owner_user_id left join staff_users tu on tu.id = h.to_owner_user_id
     where h.task_id = $1 order by h.created_at`,
    [id],
  );
  const notes = await db.query("select n.*, u.display_name as author_name from task_notes n join staff_users u on u.id = n.author_user_id where n.task_id = $1 order by n.created_at", [id]);
  return { ...task, history: history.rows, notes: notes.rows };
}

function validateTaskRules(input: { priority: TaskPriority; dueDate: string | null; title: string }): void {
  if (!input.title.trim()) throw new TaskRuleError("Title is required.", "title");
  if (input.dueDate && !isValidDate(input.dueDate)) throw new TaskRuleError("Due date must be a valid date.", "dueDate");
  if ((input.priority === "high" || input.priority === "critical") && !input.dueDate) {
    throw new TaskRuleError("High and Critical tasks need a due date.", "dueDate");
  }
}

async function validateRelated(db: Queryable, clientId: string, type: string | null, id: string | null): Promise<void> {
  if (!type && !id) return;
  if (!type || !id) throw new TaskRuleError("Choose both a record type and a record.", "relatedId");
  const found = await resolveRelated(db, clientId, type, id);
  if (!found) throw new TaskRuleError("The related record does not belong to this client.", "relatedId");
}

export async function createTask(db: Queryable, input: TaskInput, actorUserId: string): Promise<string> {
  validateTaskRules(input);
  await validateRelated(db, input.clientId, input.relatedType, input.relatedId);
  const { rows } = await db.query<{ id: string }>(
    `insert into tasks (client_id, title, description, owner_user_id, priority, due_date, related_type, related_id, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [input.clientId, input.title.trim(), input.description, input.ownerUserId, input.priority, input.dueDate, input.relatedType, input.relatedId, actorUserId],
  );
  const id = rows[0]!.id;
  await db.query("insert into task_history (task_id, client_id, from_status, to_status, to_owner_user_id, actor_user_id, note) values ($1, $2, null, 'open', $3, $4, 'Task created')", [id, input.clientId, input.ownerUserId, actorUserId]);
  await recordAudit(db, { actorType: "staff", actorUserId, action: "task.create", targetType: "task", targetId: id, clientId: input.clientId, outcome: "success", metadata: { priority: input.priority } });
  await recordTimeline(db, { clientId: input.clientId, eventType: "task_created", title: `Task created: ${input.title.trim()}`, relatedType: "task", relatedId: id, actorUserId, dedupeKey: `task_created:${id}` });
  return id;
}

export async function updateTaskDetails(db: Queryable, id: string, input: Omit<TaskInput, "clientId">, actorUserId: string): Promise<void> {
  const current = await getTask(db, id);
  if (!current) throw new TaskRuleError("Task not found.");
  if (current.status === "completed" || current.status === "cancelled") throw new TaskRuleError("Completed and cancelled tasks cannot be edited. Reopen or create a new task.");
  validateTaskRules(input);
  await validateRelated(db, current.client_id, input.relatedType, input.relatedId);
  await db.query(
    `update tasks set title = $2, description = $3, owner_user_id = $4, priority = $5, due_date = $6, related_type = $7, related_id = $8, updated_at = now() where id = $1`,
    [id, input.title.trim(), input.description, input.ownerUserId, input.priority, input.dueDate, input.relatedType, input.relatedId],
  );
  if (current.owner_user_id !== input.ownerUserId) {
    await db.query("insert into task_history (task_id, client_id, from_status, to_status, from_owner_user_id, to_owner_user_id, actor_user_id, note) values ($1, $2, $3, $3, $4, $5, $6, 'Owner changed')", [id, current.client_id, current.status, current.owner_user_id, input.ownerUserId, actorUserId]);
  }
  await recordAudit(db, { actorType: "staff", actorUserId, action: "task.update", targetType: "task", targetId: id, clientId: current.client_id, outcome: "success", metadata: { ownerChanged: current.owner_user_id !== input.ownerUserId } });
}

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ["in_progress", "waiting", "completed", "cancelled"],
  in_progress: ["open", "waiting", "completed", "cancelled"],
  waiting: ["open", "in_progress", "completed", "cancelled"],
  completed: ["open"],
  cancelled: ["open"],
};

export interface TransitionInput {
  status: TaskStatus;
  note: string | null;
  waitingOn?: string | null;
  followUpDate?: string | null;
}

/** Changes status with history preserved. Waiting needs a waiting-on value and a follow-up date. */
export async function transitionTask(db: Queryable, id: string, input: TransitionInput, actorUserId: string): Promise<void> {
  const { rows } = await db.query<{ status: TaskStatus; client_id: string; title: string }>("select status, client_id, title from tasks where id = $1 for update", [id]);
  const current = rows[0];
  if (!current) throw new TaskRuleError("Task not found.");
  if (!TRANSITIONS[current.status].includes(input.status)) throw new TaskRuleError(`Cannot move a ${current.status.replace("_", " ")} task to ${input.status.replace("_", " ")}.`);
  if (input.status === "waiting") {
    if (!input.waitingOn?.trim()) throw new TaskRuleError("Say who or what the task is waiting on.", "waitingOn");
    if (!input.followUpDate || !isValidDate(input.followUpDate)) throw new TaskRuleError("Waiting tasks need a follow-up date.", "followUpDate");
  }
  await db.query(
    `update tasks set status = $2,
       waiting_on = case when $2 = 'waiting' then $3 else null end,
       follow_up_date = case when $2 = 'waiting' then $4::date else null end,
       completed_at = case when $2 = 'completed' then now() when $2 in ('open','in_progress','waiting') then null else completed_at end,
       cancelled_at = case when $2 = 'cancelled' then now() when $2 in ('open','in_progress','waiting') then null else cancelled_at end,
       updated_at = now()
     where id = $1`,
    [id, input.status, input.waitingOn?.trim() ?? null, input.followUpDate ?? null],
  );
  await db.query("insert into task_history (task_id, client_id, from_status, to_status, actor_user_id, note) values ($1, $2, $3, $4, $5, $6)", [id, current.client_id, current.status, input.status, actorUserId, input.note]);
  await recordAudit(db, { actorType: "staff", actorUserId, action: "task.transition", targetType: "task", targetId: id, clientId: current.client_id, outcome: "success", metadata: { from: current.status, to: input.status } });
  if (input.status === "completed" || input.status === "cancelled") {
    await recordTimeline(db, {
      clientId: current.client_id,
      eventType: input.status === "completed" ? "task_completed" : "task_cancelled",
      title: `Task ${input.status}: ${current.title}`,
      summary: input.note,
      relatedType: "task",
      relatedId: id,
      actorUserId,
      dedupeKey: `task_${input.status}:${id}:${new Date().toISOString().slice(0, 13)}`,
    });
  }
}

export async function addTaskNote(db: Queryable, taskId: string, body: string, actorUserId: string): Promise<void> {
  const { rows } = await db.query<{ client_id: string }>("select client_id from tasks where id = $1", [taskId]);
  if (!rows[0]) throw new TaskRuleError("Task not found.");
  if (!body.trim()) throw new TaskRuleError("Note cannot be empty.", "body");
  await db.query("insert into task_notes (task_id, client_id, author_user_id, body) values ($1, $2, $3, $4)", [taskId, rows[0].client_id, actorUserId, body.trim()]);
}

export interface TaskCounts {
  open: number;
  overdue: number;
  waiting: number;
  due_today: number;
}

export async function taskCounts(db: Queryable, opts: { clientId?: string; ownerUserId?: string; today: string }): Promise<TaskCounts> {
  const { rows } = await db.query<TaskCounts>(
    `select count(*) filter (where status in ('open','in_progress','waiting'))::int as open,
            count(*) filter (where status in ('open','in_progress') and due_date < $3::date)::int as overdue,
            count(*) filter (where status = 'waiting')::int as waiting,
            count(*) filter (where status in ('open','in_progress') and due_date = $3::date)::int as due_today
     from tasks where ($1::uuid is null or client_id = $1) and ($2::uuid is null or owner_user_id = $2)`,
    [opts.clientId ?? null, opts.ownerUserId ?? null, opts.today],
  );
  return rows[0]!;
}
