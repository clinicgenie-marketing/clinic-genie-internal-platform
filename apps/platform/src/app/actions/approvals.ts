"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEditClient, canReviewClient, createApproval, decideApproval, getApproval, submitApproval, updateDraft, withdrawApproval } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { bool, optional, str, toActionError, type ActionState } from "@/lib/actions";

function revalidate(id?: string) {
  revalidatePath("/");
  revalidatePath("/approvals");
  revalidatePath("/clients", "layout");
  if (id) revalidatePath(`/approvals/${id}`);
}

export async function createApprovalAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const clientId = str(form, "clientId");
  if (!canEditClient(access, clientId)) return { ok: false, error: "You cannot request approvals for this client." };
  let id: string;
  try {
    id = await staffTx(access, (db) =>
      createApproval(db, { clientId, title: str(form, "title"), summary: optional(form, "summary"), requestType: str(form, "requestType") || "other", relatedType: optional(form, "relatedType"), relatedId: optional(form, "relatedId") }, access.user.id, bool(form, "submit")),
    );
  } catch (err) {
    return toActionError(err);
  }
  revalidate(id);
  redirect(`/approvals/${id}`);
}

export async function updateApprovalAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = str(form, "approvalId");
  try {
    await staffTx(access, async (db) => {
      const a = await getApproval(db, id);
      if (!a || !canEditClient(access, a.client_id)) throw Object.assign(new Error("You cannot edit this request."), { name: "ApprovalRuleError" });
      await updateDraft(db, id, { title: str(form, "title"), summary: optional(form, "summary"), requestType: str(form, "requestType") || "other", relatedType: optional(form, "relatedType"), relatedId: optional(form, "relatedId") }, access.user.id);
      if (bool(form, "submit")) await submitApproval(db, id, access.user.id);
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidate(id);
  return { ok: true, message: bool(form, "submit") ? "Submitted for decision." : "Draft saved." };
}

export async function approvalWorkflowAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = str(form, "approvalId");
  const op = str(form, "op");
  try {
    await staffTx(access, async (db) => {
      const a = await getApproval(db, id);
      if (!a) throw Object.assign(new Error("Approval not found."), { name: "ApprovalRuleError" });
      if (op === "submit" || op === "withdraw") {
        if (!canEditClient(access, a.client_id)) throw Object.assign(new Error("You cannot change this request."), { name: "ApprovalRuleError" });
        if (op === "submit") await submitApproval(db, id, access.user.id);
        else await withdrawApproval(db, id, access.user.id);
      } else if (op === "approve" || op === "changes") {
        if (!canReviewClient(access, a.client_id)) throw Object.assign(new Error("You are not authorised to decide approvals for this client."), { name: "ApprovalRuleError" });
        await decideApproval(db, id, { outcome: op === "approve" ? "approved" : "changes_requested", note: optional(form, "note") }, access.user.id);
      }
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidate(id);
  return { ok: true, message: "Recorded." };
}
