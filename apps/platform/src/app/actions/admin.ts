"use server";

import { revalidatePath } from "next/cache";
import { createStaff, updateStaff, type PlatformRole } from "@clinic-genie/db";
import { PLATFORM_ROLES } from "@clinic-genie/contracts";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { bool, str, toActionError, type ActionState } from "@/lib/actions";

function role(form: FormData): PlatformRole | null {
  const r = str(form, "role");
  return (PLATFORM_ROLES as readonly string[]).includes(r) ? (r as PlatformRole) : null;
}

export async function createStaffAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  if (access.user.platform_role !== "admin") return { ok: false, error: "Only admins can add staff." };
  const r = role(form);
  if (!r) return { ok: false, error: "Choose a role.", field: "role" };
  try {
    await staffTx(access, (db) => createStaff(db, { email: str(form, "email"), displayName: str(form, "displayName"), role: r }, access.user.id));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Staff member added. They can sign in with that email once a sign-in method is configured." };
}

export async function updateStaffAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await requireAccess();
  if (access.user.platform_role !== "admin") return { ok: false, error: "Only admins can change staff records." };
  const userId = str(form, "userId");
  const r = role(form);
  if (!r) return { ok: false, error: "Choose a role.", field: "role" };
  const active = !bool(form, "deactivate");
  if (userId === access.user.id && (r !== "admin" || !active)) return { ok: false, error: "You cannot remove your own admin role or deactivate yourself." };
  try {
    await staffTx(access, (db) => updateStaff(db, userId, { displayName: str(form, "displayName"), role: r, active }, access.user.id));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/clients", "layout");
  return { ok: true, message: "Staff record saved." };
}
