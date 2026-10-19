"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { archiveSeoPage, canEditClient, createSeoPage, getSeoPage, recordSeoChange, updateSeoPage, verifySeoChange, type SeoPageInput } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { optional, str, toActionError, type ActionState } from "@/lib/actions";

function revalidate(id?: string) {
  revalidatePath("/seo", "layout");
  revalidatePath("/clients", "layout");
  revalidatePath("/timeline");
  if (id) revalidatePath(`/seo/pages/${id}`);
}

function pageInput(form: FormData): SeoPageInput {
  return {
    websiteId: optional(form, "websiteId"),
    pagePath: str(form, "pagePath"),
    pageTitle: optional(form, "pageTitle"),
    primaryKeyword: optional(form, "primaryKeyword"),
    secondaryKeywords: str(form, "secondaryKeywords").split(",").map((s) => s.trim()).filter(Boolean),
    searchIntent: optional(form, "searchIntent"),
    contentStatus: str(form, "contentStatus") || "planned",
    ownerUserId: optional(form, "ownerUserId"),
    lastReviewedOn: optional(form, "lastReviewedOn"),
    nextReviewOn: optional(form, "nextReviewOn"),
    mappingFlag: str(form, "mappingFlag") || "none",
    flagNote: optional(form, "flagNote"),
    notes: optional(form, "notes"),
  };
}

export async function savePageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const clientId = str(form, "clientId");
  const pageId = optional(form, "pageId");
  if (!canEditClient(access, clientId)) return { ok: false, error: "You cannot edit SEO records for this client." };
  let id = pageId;
  try {
    await staffTx(access, async (db) => {
      if (pageId) {
        const p = await getSeoPage(db, pageId);
        if (!p || p.client_id !== clientId) throw Object.assign(new Error("Page not found."), { name: "SeoRuleError" });
        await updateSeoPage(db, pageId, pageInput(form), access.user.id);
      } else {
        id = await createSeoPage(db, clientId, pageInput(form), access.user.id);
      }
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidate(id ?? undefined);
  if (!pageId) redirect(`/seo/pages/${id}`);
  return { ok: true, message: "Page mapping saved." };
}

export async function archivePageAction(form: FormData): Promise<void> {
  const access = await requireAccess();
  const id = str(form, "pageId");
  await staffTx(access, async (db) => {
    const p = await getSeoPage(db, id);
    if (!p || !canEditClient(access, p.client_id)) return;
    await archiveSeoPage(db, id, access.user.id);
  });
  revalidate(id);
  redirect("/seo");
}

export async function recordChangeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const pageId = str(form, "pageId");
  try {
    await staffTx(access, async (db) => {
      const p = await getSeoPage(db, pageId);
      if (!p || !canEditClient(access, p.client_id)) throw Object.assign(new Error("You cannot record changes for this page."), { name: "SeoRuleError" });
      await recordSeoChange(db, pageId, { changeType: str(form, "changeType") || "other", beforeValue: optional(form, "beforeValue"), afterValue: optional(form, "afterValue"), reason: str(form, "reason"), changedOn: str(form, "changedOn"), approvalId: optional(form, "approvalId") }, access.user.id);
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidate(pageId);
  return { ok: true, message: "Change recorded." };
}

export async function verifyChangeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const changeId = str(form, "changeId");
  const pageId = str(form, "pageId");
  try {
    await staffTx(access, async (db) => {
      const p = await getSeoPage(db, pageId);
      if (!p || !canEditClient(access, p.client_id) || !p.changes.some((c) => c.id === changeId)) throw Object.assign(new Error("You cannot verify this change."), { name: "SeoRuleError" });
      await verifySeoChange(db, changeId, { verificationOn: str(form, "verificationOn"), outcomeNote: str(form, "outcomeNote") }, access.user.id);
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidate(pageId);
  return { ok: true, message: "Verification recorded." };
}
