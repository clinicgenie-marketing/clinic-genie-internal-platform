"use server";

import { revalidatePath } from "next/cache";
import { canEditClient, canManageRegistry, getClient, recordAudit, saveFormRoute } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { createTestSubmission } from "@/lib/form-submissions";
import { optional, str, toActionError, type ActionState } from "@/lib/actions";

function clientId(form: FormData): string {
  const id = str(form, "clientId");
  return /^[0-9a-f-]{36}$/.test(id) ? id : "";
}

export async function saveFormRouteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  if (!canManageRegistry(access)) return { ok: false, error: "Only admins and managers can save form routing." };
  const id = clientId(form);
  if (!id) return { ok: false, error: "Choose a client." };
  const recipient = optional(form, "recipientContactId");
  if (recipient && !/^[0-9a-f-]{36}$/.test(recipient)) return { ok: false, error: "Choose a contact from this client.", field: "recipientContactId" };
  const message = optional(form, "confirmationMessage");
  try {
    await staffTx(access, (db) => saveFormRoute(db, {
      clientId: id,
      recipientContactId: recipient,
      confirmationMessage: message,
      updatedBy: access.user.id,
    }));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/forms");
  return { ok: true, message: "Form routing saved. The clinic website still sends mail from its own configuration." };
}

export async function testSubmissionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = clientId(form);
  if (!id) return { ok: false, error: "Choose a client." };
  if (!canEditClient(access, id)) return { ok: false, error: "You do not have permission to send a test submission." };
  try {
    const client = await staffTx(access, (db) => getClient(db, id));
    if (!client) return { ok: false, error: "That client is not available." };
    const stored = await createTestSubmission(client.slug);
    if (stored === "not_connected") return { ok: false, error: "The clinic website database is not connected. Nothing was stored." };
    if (stored === "rejected") return { ok: false, error: "This client is not in the website database, so no test enquiry was stored." };
    await staffTx(access, (db) => recordAudit(db, {
      actorType: "staff",
      actorUserId: access.user.id,
      action: "enquiry.test_submission",
      targetType: "form_submission",
      targetId: stored.id,
      clientId: id,
      outcome: "success",
      metadata: { reference: stored.reference },
    }));
    revalidatePath("/enquiries");
    return { ok: true, message: `Test enquiry ${stored.reference} is in Enquiries. It is demonstration data.` };
  } catch (err) {
    return toActionError(err);
  }
}
