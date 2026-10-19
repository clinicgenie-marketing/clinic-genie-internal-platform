"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addAdsFinding, canEditClient, closeAdsAudit, createAdsAudit, getAdsAudit, getAdsChange, recordAdsChange, setAdsFindingStatus, updateAdsAudit, verifyAdsChange } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { optional, str, toActionError, type ActionState } from "@/lib/actions";

function revalidate() {
  revalidatePath("/google-ads", "layout");
  revalidatePath("/clients", "layout");
  revalidatePath("/timeline");
}

export async function saveAuditAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const clientId = str(form, "clientId");
  const auditId = optional(form, "auditId");
  if (!canEditClient(access, clientId)) return { ok: false, error: "You cannot edit Google Ads records for this client." };
  const input = { accountReferenceId: optional(form, "accountReferenceId"), title: str(form, "title"), periodStart: str(form, "periodStart"), periodEnd: str(form, "periodEnd"), scope: str(form, "scope"), summary: optional(form, "summary") };
  let id = auditId;
  try {
    await staffTx(access, async (db) => {
      if (auditId) {
        const a = await getAdsAudit(db, auditId);
        if (!a || a.client_id !== clientId) throw Object.assign(new Error("Audit not found."), { name: "AdsRuleError" });
        await updateAdsAudit(db, auditId, input, access.user.id);
      } else id = await createAdsAudit(db, clientId, input, access.user.id);
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidate();
  if (!auditId) redirect(`/google-ads/audits/${id}`);
  return { ok: true, message: "Audit saved." };
}

export async function closeAuditAction(form: FormData): Promise<void> {
  const access = await requireAccess();
  const id = str(form, "auditId");
  await staffTx(access, async (db) => {
    const a = await getAdsAudit(db, id);
    if (!a || !canEditClient(access, a.client_id)) return;
    await closeAdsAudit(db, id, access.user.id);
  });
  revalidate();
}

export async function addFindingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const auditId = str(form, "auditId");
  try {
    await staffTx(access, async (db) => {
      const a = await getAdsAudit(db, auditId);
      if (!a || !canEditClient(access, a.client_id)) throw Object.assign(new Error("You cannot add findings to this audit."), { name: "AdsRuleError" });
      await addAdsFinding(db, auditId, { area: str(form, "area") || "other", finding: str(form, "finding"), severity: str(form, "severity") || "medium", recommendation: optional(form, "recommendation") }, access.user.id);
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidate();
  return { ok: true, message: "Finding added." };
}

export async function findingStatusAction(form: FormData): Promise<void> {
  const access = await requireAccess();
  const auditId = str(form, "auditId");
  const findingId = str(form, "findingId");
  const status = str(form, "status");
  if (!["open", "implemented", "dismissed"].includes(status)) return;
  await staffTx(access, async (db) => {
    const a = await getAdsAudit(db, auditId);
    if (!a || !canEditClient(access, a.client_id) || !a.findings.some((f) => f.id === findingId)) return;
    await setAdsFindingStatus(db, findingId, status, access.user.id);
  });
  revalidate();
}

export async function recordAdsChangeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const clientId = str(form, "clientId");
  if (!canEditClient(access, clientId)) return { ok: false, error: "You cannot record changes for this client." };
  let id: string;
  try {
    id = await staffTx(access, (db) =>
      recordAdsChange(db, clientId, {
        auditId: optional(form, "auditId"),
        findingId: optional(form, "findingId"),
        scope: str(form, "scope"),
        description: str(form, "description"),
        beforeValue: optional(form, "beforeValue"),
        afterValue: optional(form, "afterValue"),
        reason: str(form, "reason"),
        responsibleUserId: str(form, "responsibleUserId") || access.user.id,
        approvalId: optional(form, "approvalId"),
        implementedOn: str(form, "implementedOn"),
      }, access.user.id),
    );
  } catch (err) {
    return toActionError(err);
  }
  revalidate();
  redirect(`/google-ads/changes/${id}`);
}

export async function verifyAdsChangeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = str(form, "changeId");
  try {
    await staffTx(access, async (db) => {
      const c = await getAdsChange(db, id);
      if (!c || !canEditClient(access, c.client_id)) throw Object.assign(new Error("You cannot verify this change."), { name: "AdsRuleError" });
      await verifyAdsChange(db, id, { verificationOn: str(form, "verificationOn"), outcomeNote: str(form, "outcomeNote") }, access.user.id);
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidate();
  return { ok: true, message: "Verification recorded." };
}
