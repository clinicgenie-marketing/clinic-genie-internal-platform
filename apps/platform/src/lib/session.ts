import { cache } from "react";
import { redirect } from "next/navigation";
import {
  SERVICE,
  canAccessClient,
  canEditClient,
  canManageRegistry,
  canManageUsers,
  canReviewClient,
  getActiveStaffByEmail,
  resolveAccess,
  withContext,
  type AccessProfile,
} from "@clinic-genie/db";
import { auth } from "./auth";

/** Resolves the current staff access profile from the session, server-side, once per request. */
export const getAccess = cache(async (): Promise<AccessProfile | null> => {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    // #region agent log
    fetch("http://127.0.0.1:7777/ingest/d1e6aa15-e325-4576-8252-5cc7335c095b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "4b5b07" }, body: JSON.stringify({ sessionId: "4b5b07", runId: "verify", hypothesisId: "D", location: "apps/platform/src/lib/session.ts:getAccess", message: "no session email", data: { hasSession: Boolean(session) }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
    return null;
  }
  const profile = await withContext(SERVICE, async (db) => {
    const staff = await getActiveStaffByEmail(db, email);
    if (!staff) return null;
    return resolveAccess(db, staff.id);
  });
  // #region agent log
  fetch("http://127.0.0.1:7777/ingest/d1e6aa15-e325-4576-8252-5cc7335c095b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "4b5b07" }, body: JSON.stringify({ sessionId: "4b5b07", runId: "verify", hypothesisId: profile ? "D" : "E", location: "apps/platform/src/lib/session.ts:getAccess", message: profile ? "session resolved to staff" : "session email has no staff profile", data: { resolved: Boolean(profile) }, timestamp: Date.now() }) }).catch(() => {});
  // #endregion
  return profile;
});

export async function requireAccess(): Promise<AccessProfile> {
  const access = await getAccess();
  if (!access) redirect("/sign-in");
  return access;
}

export async function requireClientAccess(clientId: string): Promise<AccessProfile> {
  const access = await requireAccess();
  if (!canAccessClient(access, clientId)) redirect("/clients?denied=1");
  return access;
}

export const permissions = { canAccessClient, canEditClient, canReviewClient, canManageRegistry, canManageUsers };
