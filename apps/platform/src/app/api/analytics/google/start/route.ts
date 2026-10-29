import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { canManageRegistry, createOAuthState } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { serviceTx } from "@/lib/db";

export async function GET(request: Request) {
  const access = await requireAccess();
  if (!canManageRegistry(access)) return NextResponse.redirect(new URL("/settings?analyticsError=denied", request.url));
  const clientId = process.env.ANALYTICS_GOOGLE_CLIENT_ID;
  const secret = process.env.ANALYTICS_GOOGLE_CLIENT_SECRET;
  if (!clientId || !secret || !process.env.ANALYTICS_TOKEN_KEY) {
    return NextResponse.redirect(new URL("/settings?analyticsError=not_configured", request.url));
  }
  const url = new URL(request.url);
  const websiteId = url.searchParams.get("website") ?? "";
  const client = url.searchParams.get("client") ?? "";
  const provider = url.searchParams.get("provider") === "gsc" ? "gsc" : "ga4";
  const redirectUri = new URL("/api/analytics/google/callback", process.env.AUTH_URL || url.origin).toString();
  const created = await serviceTx((db) => createOAuthState(db, {
    actorUserId: access.user.id,
    clientId: client,
    websiteId,
    provider,
    redirectUri,
  }));
  const challenge = createHash("sha256").update(created.verifier).digest("base64url");
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly");
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("state", created.state);
  auth.searchParams.set("code_challenge", challenge);
  auth.searchParams.set("code_challenge_method", "S256");
  return NextResponse.redirect(auth);
}
