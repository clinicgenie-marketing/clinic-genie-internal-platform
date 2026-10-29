"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AnalyticsRuleError,
  bindConnectionFromState,
  canManageRegistry,
  disconnectConnection,
  encryptSecret,
  enqueueDue,
  listConnections,
  listWebsites,
  readExchangedToken,
  recordImport,
  saveConnection,
  setSourcePolicy,
  todaySgt,
} from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { serviceTx, staffTx } from "@/lib/db";
import { str } from "@/lib/actions";
import { listGoogleProperties } from "@/lib/analytics-properties";

function fail(code: string): never {
  redirect(`/settings?analyticsError=${code}`);
}

async function managerWebsite(clientId: string, websiteId: string) {
  const access = await requireAccess();
  if (!canManageRegistry(access)) fail("denied");
  const website = await staffTx(access, async (db) => (await listWebsites(db, clientId)).find((row) => row.id === websiteId) ?? null);
  if (!website) fail("denied");
  return access;
}

export async function bindAnalyticsProperty(formData: FormData) {
  const access = await requireAccess();
  if (!canManageRegistry(access)) fail("denied");
  const state = str(formData, "state");
  const propertyId = str(formData, "propertyId");
  if (!state || !propertyId) fail("property_required");
  const pending = await serviceTx((db) => readExchangedToken(db, state, access.user.id));
  if (!pending || (pending.provider !== "ga4" && pending.provider !== "gsc")) fail("oauth_failed");
  const website = await staffTx(access, async (db) => (await listWebsites(db, pending.clientId)).find((row) => row.id === pending.websiteId) ?? null);
  if (!website) fail("denied");
  const listed = await listGoogleProperties(pending.accessToken, pending.provider);
  if (!listed.properties.some((property) => property.id === propertyId)) fail("property_unknown");
  const family = pending.provider === "gsc" ? "search" : "traffic";
  try {
    await serviceTx(async (db) => {
      if (family === "traffic") {
        const current = await listConnections(db, pending.clientId);
        const other = current.find((row) => row.website_id === pending.websiteId && row.disconnected_at === null && (row.provider === "ga4" || row.provider === "wix"));
        if (other) throw new AnalyticsRuleError("traffic_exists");
      }
      const connection = await bindConnectionFromState(db, {
        state,
        actorUserId: access.user.id,
        externalPropertyId: propertyId,
        providerTimezone: pending.provider === "gsc" ? "America/Los_Angeles" : "Asia/Singapore",
      });
      await setSourcePolicy(db, {
        clientId: pending.clientId,
        websiteId: pending.websiteId,
        reportFamily: family,
        connectionId: connection.id,
        effectiveFrom: todaySgt(),
        actorUserId: access.user.id,
      });
      await enqueueDue(db, new Date(), pending.websiteId);
    });
  } catch (error) {
    if (error instanceof AnalyticsRuleError && error.message === "traffic_exists") fail("traffic_exists");
    console.error("Analytics bind failed", { name: error instanceof Error ? error.name : "Error" });
    fail("oauth_failed");
  }
  revalidatePath("/settings");
  revalidatePath("/analytics");
  redirect("/settings?analytics=connected");
}

export async function connectWix(formData: FormData) {
  const clientId = str(formData, "clientId");
  const websiteId = str(formData, "websiteId");
  const instanceId = str(formData, "instanceId");
  const access = await managerWebsite(clientId, websiteId);
  const appId = process.env.ANALYTICS_WIX_APP_ID;
  const appSecret = process.env.ANALYTICS_WIX_APP_SECRET;
  if (!appId || !appSecret || !process.env.ANALYTICS_TOKEN_KEY) fail("not_configured");
  if (!instanceId || instanceId.length > 200) fail("wix_rejected");
  const response = await fetch("https://www.wixapis.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: appId, client_secret: appSecret, instance_id: instanceId }),
    cache: "no-store",
  });
  const token = await response.json() as { access_token?: string; expires_in?: number };
  if (!response.ok || !token.access_token) fail("wix_rejected");
  const sealed = encryptSecret(JSON.stringify({
    accessToken: token.access_token,
    expiresAt: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
    instanceId,
  }));
  try {
    await serviceTx(async (db) => {
      const current = await listConnections(db, clientId);
      const other = current.find((row) => row.website_id === websiteId && row.disconnected_at === null && (row.provider === "ga4" || row.provider === "wix"));
      if (other) throw new AnalyticsRuleError("traffic_exists");
      const connection = await saveConnection(db, {
        clientId,
        websiteId,
        provider: "wix",
        externalPropertyId: instanceId,
        streamOrSiteRef: instanceId,
        providerTimezone: "Asia/Singapore",
        tokenCiphertext: sealed.ciphertext,
        tokenNonce: sealed.nonce,
        actorUserId: access.user.id,
      });
      await setSourcePolicy(db, {
        clientId,
        websiteId,
        reportFamily: "traffic",
        connectionId: connection.id,
        effectiveFrom: todaySgt(),
        actorUserId: access.user.id,
      });
      await enqueueDue(db, new Date(), websiteId);
    });
  } catch (error) {
    if (error instanceof AnalyticsRuleError && error.message === "traffic_exists") fail("traffic_exists");
    console.error("Wix connection failed", { name: error instanceof Error ? error.name : "Error" });
    fail("wix_rejected");
  }
  revalidatePath("/settings");
  revalidatePath("/analytics");
  redirect("/settings?analytics=connected");
}

export async function disconnectAnalytics(formData: FormData) {
  const access = await requireAccess();
  if (!canManageRegistry(access)) fail("denied");
  const connectionId = str(formData, "connectionId");
  if (!connectionId) fail("denied");
  await serviceTx((db) => disconnectConnection(db, { connectionId, actorUserId: access.user.id }));
  revalidatePath("/settings");
  revalidatePath("/analytics");
  redirect("/settings?analytics=disconnected");
}

export async function refreshAnalytics(formData: FormData) {
  const clientId = str(formData, "clientId");
  const websiteId = str(formData, "websiteId");
  await managerWebsite(clientId, websiteId);
  await serviceTx((db) => enqueueDue(db, new Date(), websiteId));
  revalidatePath("/settings");
  redirect("/settings?analytics=queued");
}

export async function importAnalyticsCsv(formData: FormData) {
  const clientId = str(formData, "clientId");
  const websiteId = str(formData, "websiteId");
  const access = await managerWebsite(clientId, websiteId);
  const text = str(formData, "csv");
  if (!text || text.length > 200_000) fail("import_rejected");
  const result = await staffTx(access, (db) => recordImport(db, {
    clientId,
    websiteId,
    reportType: "metric_csv",
    timezone: "Asia/Singapore",
    text,
    actorUserId: access.user.id,
    replace: formData.get("replace") === "on",
  }));
  revalidatePath("/settings");
  if (result.error || result.decision === "reject") fail("import_rejected");
  redirect(`/settings?analytics=${result.decision}`);
}
