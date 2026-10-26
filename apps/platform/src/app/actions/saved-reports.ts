"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEditClient, createSavedReport, duplicateSavedReport, getSavedReport, saveSavedReport } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { list, optional, str, toActionError, type ActionState } from "@/lib/actions";

function inputFrom(form: FormData) {
  return {
    clientId: str(form, "clientId"),
    name: str(form, "name"),
    periodStart: str(form, "periodStart"),
    periodEnd: str(form, "periodEnd"),
    comparisonStart: optional(form, "comparisonStart"),
    comparisonEnd: optional(form, "comparisonEnd"),
    sections: list(form, "sections"),
    summary: optional(form, "summary"),
    observations: optional(form, "observations"),
    actionsTaken: optional(form, "actionsTaken"),
    nextSteps: optional(form, "nextSteps"),
    dataSourcesNote: optional(form, "dataSourcesNote"),
    missingConnections: optional(form, "missingConnections"),
    measurementLimitations: optional(form, "measurementLimitations"),
  };
}

function revalidate() {
  revalidatePath("/reports");
  revalidatePath("/timeline");
}

export async function createSavedReportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const input = inputFrom(form);
  if (!input.clientId) return { ok: false, error: "Choose a client.", field: "clientId" };
  if (!canEditClient(access, input.clientId)) return { ok: false, error: "You cannot create a report for this client." };
  let id = "";
  try {
    id = await staffTx(access, (db) => createSavedReport(db, input, access.user.id));
  } catch (err) {
    return toActionError(err);
  }
  revalidate();
  redirect(`/reports/${id}`);
}

export async function saveSavedReportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = str(form, "reportId");
  const input = inputFrom(form);
  if (!canEditClient(access, input.clientId)) return { ok: false, error: "You cannot save a report for this client." };
  let version = 0;
  try {
    version = await staffTx(access, (db) => saveSavedReport(db, id, input, access.user.id));
  } catch (err) {
    return toActionError(err);
  }
  revalidate();
  revalidatePath(`/reports/${id}`);
  return { ok: true, message: `Saved as version ${version}. That version is kept for client review.` };
}

export async function duplicateSavedReportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = str(form, "reportId");
  let copyId = "";
  try {
    copyId = await staffTx(access, async (db) => {
      const current = await getSavedReport(db, id);
      if (!current) return "";
      if (!canEditClient(access, current.client_id)) return "";
      return duplicateSavedReport(db, id, access.user.id);
    });
  } catch (err) {
    return toActionError(err);
  }
  if (!copyId) return { ok: false, error: "You cannot duplicate that report." };
  revalidate();
  redirect(`/reports/${copyId}`);
}
