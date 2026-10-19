"use server";

import { revalidatePath } from "next/cache";
import { addReportNote, addSnapshot, canEditClient, type ReportMetricKey } from "@clinic-genie/db";
import { REPORT_METRICS } from "@clinic-genie/contracts";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { numberOrNull, optional, str, toActionError, type ActionState } from "@/lib/actions";

function revalidate() {
  revalidatePath("/reports", "layout");
  revalidatePath("/clients", "layout");
  revalidatePath("/timeline");
}

export async function addSnapshotAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const clientId = str(form, "clientId");
  if (!canEditClient(access, clientId)) return { ok: false, error: "You cannot enter figures for this client." };
  const metric = str(form, "metric");
  if (!REPORT_METRICS.some((m) => m.key === metric)) return { ok: false, error: "Choose a metric.", field: "metric" };
  const value = numberOrNull(form, "value");
  if (value !== null && Number.isNaN(value)) return { ok: false, error: "Enter a number, or leave blank when the figure is unavailable.", field: "value" };
  try {
    await staffTx(access, (db) => addSnapshot(db, clientId, { source: str(form, "source") || "manual", channel: str(form, "channel") || "all", metric: metric as ReportMetricKey, periodStart: str(form, "periodStart"), periodEnd: str(form, "periodEnd"), value, note: optional(form, "note") }, access.user.id));
  } catch (err) {
    return toActionError(err);
  }
  revalidate();
  return { ok: true, message: value === null ? "Recorded as unavailable for that period." : "Snapshot recorded." };
}

export async function addNoteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const clientId = str(form, "clientId");
  if (!canEditClient(access, clientId)) return { ok: false, error: "You cannot add observations for this client." };
  try {
    await staffTx(access, (db) => addReportNote(db, clientId, { periodStart: str(form, "periodStart"), periodEnd: str(form, "periodEnd"), observation: str(form, "observation"), possibleExplanations: optional(form, "possibleExplanations") }, access.user.id));
  } catch (err) {
    return toActionError(err);
  }
  revalidate();
  return { ok: true, message: "Observation recorded." };
}
