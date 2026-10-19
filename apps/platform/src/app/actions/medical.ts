"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addSource, addWording, assignReview, canEditClient, canReviewClient, createClaim, decideReview, getClaim, isGlobal, withdrawClaim } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { optional, str, toActionError, type ActionState } from "@/lib/actions";

function revalidate(id?: string) {
  revalidatePath("/medical-review", "layout");
  revalidatePath("/clients", "layout");
  revalidatePath("/timeline");
  if (id) revalidatePath(`/medical-review/${id}`);
}

export async function createClaimAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const clientId = str(form, "clientId");
  if (!canEditClient(access, clientId)) return { ok: false, error: "You cannot create claims for this client." };
  let id: string;
  try {
    id = await staffTx(access, (db) => createClaim(db, clientId, { claimSummary: str(form, "claimSummary"), location: optional(form, "location"), wording: str(form, "wording") }, access.user.id));
  } catch (err) {
    return toActionError(err);
  }
  revalidate(id);
  redirect(`/medical-review/${id}`);
}

export async function claimWorkflowAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = str(form, "claimId");
  const op = str(form, "op");
  try {
    await staffTx(access, async (db) => {
      const claim = await getClaim(db, id);
      if (!claim) throw Object.assign(new Error("Claim not found."), { name: "MedicalRuleError" });
      const edit = canEditClient(access, claim.client_id);
      const review = canReviewClient(access, claim.client_id);
      if (op === "wording") {
        if (!edit) throw Object.assign(new Error("You cannot change the wording."), { name: "MedicalRuleError" });
        await addWording(db, id, str(form, "wording"), access.user.id);
      } else if (op === "assign") {
        if (!edit && !review) throw Object.assign(new Error("You cannot assign reviews."), { name: "MedicalRuleError" });
        await assignReview(db, id, str(form, "reviewerUserId"), access.user.id);
      } else if (op === "source") {
        if (!edit && !review) throw Object.assign(new Error("You cannot add sources."), { name: "MedicalRuleError" });
        await addSource(db, id, { title: str(form, "title"), citation: optional(form, "citation"), url: optional(form, "url"), sourceType: str(form, "sourceType") || "other", reviewId: optional(form, "reviewId") }, access.user.id);
      } else if (op === "decide") {
        if (!review) throw Object.assign(new Error("Only reviewers, managers or admins with access can decide."), { name: "MedicalRuleError" });
        await decideReview(db, str(form, "reviewId"), { decision: str(form, "decision") as "approved" | "rejected" | "changes_required", note: str(form, "note") }, access.user.id, isGlobal(access));
      } else if (op === "withdraw") {
        if (!edit) throw Object.assign(new Error("You cannot withdraw this claim."), { name: "MedicalRuleError" });
        await withdrawClaim(db, id, access.user.id);
      }
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidate(id);
  return { ok: true, message: "Recorded." };
}
