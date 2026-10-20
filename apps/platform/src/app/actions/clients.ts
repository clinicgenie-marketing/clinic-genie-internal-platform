"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveClient, canEditClient, canManageRegistry, createAccountReference, createClient, createWebsite, grantMembership, restoreClient,
  revokeMembership, updateAccountReference, updateClient, updateWebsite, type ClientChannel, type WebsiteRow,
} from "@clinic-genie/db";
import { CLIENT_CHANNELS } from "@clinic-genie/contracts";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { bool, list, optional, str, toActionError, type ActionState } from "@/lib/actions";

function channels(form: FormData): ClientChannel[] {
  return list(form, "channels").filter((c): c is ClientChannel => (CLIENT_CHANNELS as readonly string[]).includes(c));
}

export async function createClientAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  if (!canManageRegistry(access)) return { ok: false, error: "Only admins and managers can create clients." };
  const slug = str(form, "slug").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) return { ok: false, error: "Identifier must be lowercase letters, numbers and hyphens.", field: "slug" };
  let id: string;
  try {
    const client = await staffTx(access, (db) =>
      createClient(db, { slug, name: str(form, "name"), ownerUserId: optional(form, "ownerUserId"), channels: channels(form), isSynthetic: bool(form, "isSynthetic"), notes: optional(form, "notes") }, access.user.id),
    );
    id = client.id;
  } catch (err) {
    const state = toActionError(err);
    if (state && !state.ok && (err as { code?: string }).code === "23505") return { ok: false, error: "That identifier is already in use.", field: "slug" };
    return state;
  }
  revalidatePath("/clients");
  redirect(`/clients/${id}`);
}

export async function updateClientAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  if (!canManageRegistry(access)) return { ok: false, error: "Only admins and managers can edit client profiles." };
  const id = str(form, "clientId");
  try {
    await staffTx(access, (db) => updateClient(db, id, { name: str(form, "name"), ownerUserId: optional(form, "ownerUserId"), channels: channels(form), notes: optional(form, "notes") }, access.user.id));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath(`/clients/${id}`, "layout");
  return { ok: true, message: "Profile saved." };
}

export async function archiveClientAction(form: FormData): Promise<void> {
  const access = await requireAccess();
  if (!canManageRegistry(access)) return;
  const id = str(form, "clientId");
  const restore = bool(form, "restore");
  await staffTx(access, (db) => (restore ? restoreClient(db, id, access.user.id) : archiveClient(db, id, access.user.id)));
  revalidatePath("/clients", "layout");
  redirect(`/clients/${id}`);
}

export async function saveWebsiteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const clientId = str(form, "clientId");
  if (!canEditClient(access, clientId)) return { ok: false, error: "You cannot edit this client's websites." };
  const websiteId = optional(form, "websiteId");
  const url = optional(form, "url");
  if (url && !/^https?:\/\//.test(url)) return { ok: false, error: "Website URL must start with http:// or https://.", field: "url" };
  try {
    await staffTx(access, (db) =>
      websiteId
        ? updateWebsite(db, websiteId, { name: str(form, "name"), url, platform: str(form, "platform") || "unknown", environment: (str(form, "environment") || "production") as WebsiteRow["environment"], status: (str(form, "status") || "active") as WebsiteRow["status"], notes: optional(form, "notes") }, access.user.id)
        : createWebsite(db, { clientId, name: str(form, "name"), url, platform: str(form, "platform") || "unknown", environment: (str(form, "environment") || "production") as WebsiteRow["environment"], notes: optional(form, "notes") }, access.user.id).then(() => undefined),
    );
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath(`/clients/${clientId}`, "layout");
  return { ok: true, message: "Website saved." };
}

export async function saveReferenceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const clientId = str(form, "clientId");
  if (!canEditClient(access, clientId)) return { ok: false, error: "You cannot edit this client's account references." };
  const refId = optional(form, "referenceId");
  const input = { kind: str(form, "kind") || "other", label: str(form, "label"), externalIdentifier: optional(form, "externalIdentifier"), url: optional(form, "url"), vaultReference: optional(form, "vaultReference"), notes: optional(form, "notes") };
  if (!input.label) return { ok: false, error: "Label is required.", field: "label" };
  if (input.url && !/^https?:\/\//.test(input.url)) return { ok: false, error: "Link must start with http:// or https://.", field: "url" };
  try {
    await staffTx(access, (db) => (refId ? updateAccountReference(db, refId, { ...input, active: !bool(form, "deactivate") }, access.user.id) : createAccountReference(db, clientId, input, access.user.id).then(() => undefined)));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath(`/clients/${clientId}`, "layout");
  return { ok: true, message: "Reference saved. Secrets stay in the vault." };
}

export async function membershipAction(form: FormData): Promise<void> {
  const access = await requireAccess();
  if (access.user.platform_role !== "admin") return;
  const clientId = str(form, "clientId");
  const membershipId = optional(form, "membershipId");
  const userId = optional(form, "userId");
  await staffTx(access, (db) => (membershipId ? revokeMembership(db, membershipId, access.user.id) : userId ? grantMembership(db, { userId, clientId }, access.user.id).then(() => undefined) : Promise.resolve()));
  revalidatePath(`/clients/${clientId}`, "layout");
  revalidatePath("/admin", "layout");
}
