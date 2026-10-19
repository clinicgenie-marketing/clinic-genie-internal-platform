import type { TaskPriority } from "@clinic-genie/contracts";
import { daysBetween } from "./dates";
import type { TaskRow } from "./tasks";

/**
 * Deterministic action-queue scoring. The pack file 05_DASHBOARD_ACTION_QUEUE.md was not supplied,
 * so this is the proposed rule set, documented in docs/QUEUE_SCORING.md.
 */
export type QueueSection = "urgent" | "due_today" | "waiting" | "upcoming" | "later";

export interface QueuedTask {
  task: TaskRow;
  section: QueueSection;
  score: number;
  daysOverdue: number;
  daysUntilDue: number | null;
  followUpDue: boolean;
  reasons: string[];
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { critical: 40, high: 30, medium: 20, low: 10 };
const PRIORITY_RANK: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function classifyTask(task: TaskRow, today: string): QueuedTask {
  const reasons: string[] = [];
  const daysUntilDue = task.due_date ? daysBetween(today, task.due_date) : null;
  const daysOverdue = daysUntilDue !== null && daysUntilDue < 0 ? -daysUntilDue : 0;
  const followUpDue = task.status === "waiting" && !!task.follow_up_date && daysBetween(today, task.follow_up_date) <= 0;

  let score = PRIORITY_WEIGHT[task.priority];
  reasons.push(`${task.priority} priority`);
  if (daysOverdue > 0) {
    score += Math.min(daysOverdue, 14) * 5;
    reasons.push(`${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`);
  } else if (daysUntilDue === 0) {
    score += 15;
    reasons.push("due today");
  } else if (daysUntilDue !== null && daysUntilDue <= 7) {
    score += 7 - daysUntilDue;
    reasons.push(`due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`);
  }
  if (followUpDue) {
    score += 12;
    reasons.push("follow-up due");
  }

  let section: QueueSection;
  if (task.status === "waiting") section = "waiting";
  else if (daysOverdue > 0 || (task.priority === "critical" && daysUntilDue !== null && daysUntilDue <= 2)) section = "urgent";
  else if (daysUntilDue === 0) section = "due_today";
  else if (daysUntilDue !== null && daysUntilDue <= 7) section = "upcoming";
  else section = "later";

  return { task, section, score, daysOverdue, daysUntilDue, followUpDue, reasons };
}

/** Stable ordering: score desc, due date asc (nulls last), priority, created, id. */
export function compareQueued(a: QueuedTask, b: QueuedTask): number {
  if (b.score !== a.score) return b.score - a.score;
  const ad = a.task.due_date ?? "9999-12-31";
  const bd = b.task.due_date ?? "9999-12-31";
  if (ad !== bd) return ad < bd ? -1 : 1;
  const pr = PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
  if (pr !== 0) return pr;
  const ca = new Date(a.task.created_at).getTime();
  const cb = new Date(b.task.created_at).getTime();
  if (ca !== cb) return ca - cb;
  return a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0;
}

export interface Queue {
  urgent: QueuedTask[];
  dueToday: QueuedTask[];
  waiting: QueuedTask[];
  upcoming: QueuedTask[];
  later: QueuedTask[];
}

/** Completed and cancelled tasks are excluded before classification. */
export function buildQueue(tasks: TaskRow[], today: string): Queue {
  const active = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const classified = active.map((t) => classifyTask(t, today)).sort(compareQueued);
  return {
    urgent: classified.filter((q) => q.section === "urgent"),
    dueToday: classified.filter((q) => q.section === "due_today"),
    waiting: classified.filter((q) => q.section === "waiting"),
    upcoming: classified.filter((q) => q.section === "upcoming"),
    later: classified.filter((q) => q.section === "later"),
  };
}
