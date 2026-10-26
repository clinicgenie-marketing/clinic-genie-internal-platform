"use server";

import { revalidatePath } from "next/cache";
import { getClientBySlug, recordAudit } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { canRetryNotifications, retryNotification, submissionClinicScope } from "@/lib/form-submissions";
import { str, toActionError, type ActionState } from "@/lib/actions";

export async function retryNotificationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = str(form, "outboxId");
  if (!canRetryNotifications(access)) return { ok: false, error: "You do not have permission to retry a notification." };
  const scope = submissionClinicScope(access);
  try {
    const result = await retryNotification(scope, id);
    if (result === "unavailable") return { ok: false, error: "The clinic website database is not connected. Nothing was changed." };
    if (!result) return { ok: false, error: "That notification cannot be retried." };
    await staffTx(access, async (db) => {
      const client = await getClientBySlug(db, result.clinicId);
      await recordAudit(db, {
        actorType: "staff",
        actorUserId: access.user.id,
        action: "notification.retry",
        targetType: "notification_outbox",
        targetId: result.id,
        clientId: client?.id ?? null,
        outcome: "success",
        metadata: { clinicId: result.clinicId },
      });
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/enquiries/notifications");
  return { ok: true, message: "The notification is waiting to be sent again. No new enquiry was created." };
}
