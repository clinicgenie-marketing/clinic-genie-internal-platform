"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addTaskNote, canEditClient, createTask, getTask, transitionTask, updateTaskDetails, type TaskPriority, type TaskStatus } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { optional, str, toActionError, type ActionState } from "@/lib/actions";

function revalidateTask(id?: string) {
  revalidatePath("/");
  revalidatePath("/my-tasks");
  revalidatePath("/clients", "layout");
  if (id) revalidatePath(`/tasks/${id}`);
}

export async function createTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const clientId = str(form, "clientId");
  if (!canEditClient(access, clientId)) return { ok: false, error: "You cannot create tasks for this client." };
  let id: string;
  try {
    id = await staffTx(access, (db) =>
      createTask(db, {
        clientId,
        title: str(form, "title"),
        description: optional(form, "description"),
        ownerUserId: str(form, "ownerUserId"),
        priority: str(form, "priority") as TaskPriority,
        dueDate: optional(form, "dueDate"),
        relatedType: optional(form, "relatedType"),
        relatedId: optional(form, "relatedId"),
      }, access.user.id),
    );
  } catch (err) {
    return toActionError(err);
  }
  revalidateTask(id);
  redirect(`/tasks/${id}`);
}

export async function updateTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = str(form, "taskId");
  try {
    await staffTx(access, async (db) => {
      const task = await getTask(db, id);
      if (!task || !canEditClient(access, task.client_id)) throw Object.assign(new Error("You cannot edit this task."), { name: "TaskRuleError" });
      await updateTaskDetails(db, id, {
        title: str(form, "title"),
        description: optional(form, "description"),
        ownerUserId: str(form, "ownerUserId"),
        priority: str(form, "priority") as TaskPriority,
        dueDate: optional(form, "dueDate"),
        relatedType: optional(form, "relatedType"),
        relatedId: optional(form, "relatedId"),
      }, access.user.id);
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidateTask(id);
  return { ok: true, message: "Task saved." };
}

export async function transitionTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = str(form, "taskId");
  const status = str(form, "status") as TaskStatus;
  try {
    await staffTx(access, async (db) => {
      const task = await getTask(db, id);
      if (!task) throw Object.assign(new Error("Task not found."), { name: "TaskRuleError" });
      const mayAct = canEditClient(access, task.client_id) || task.owner_user_id === access.user.id;
      if (!mayAct || access.user.platform_role === "read_only") throw Object.assign(new Error("You cannot change this task."), { name: "TaskRuleError" });
      await transitionTask(db, id, { status, note: optional(form, "note"), waitingOn: optional(form, "waitingOn"), followUpDate: optional(form, "followUpDate") }, access.user.id);
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidateTask(id);
  return { ok: true, message: `Task marked ${status.replace("_", " ")}.` };
}

export async function addTaskNoteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = str(form, "taskId");
  try {
    await staffTx(access, async (db) => {
      const task = await getTask(db, id);
      if (!task || access.user.platform_role === "read_only") throw Object.assign(new Error("You cannot add notes to this task."), { name: "TaskRuleError" });
      await addTaskNote(db, id, str(form, "body"), access.user.id);
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidateTask(id);
  return { ok: true, message: "Note added." };
}
