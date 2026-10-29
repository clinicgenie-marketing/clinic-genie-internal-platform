import { NextResponse } from "next/server";
import { AnalyticsRuleError, canManageRegistry, decryptSecret, exchangeOAuthState, sha256 } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { serviceTx } from "@/lib/db";

export async function GET(request: Request) {
  const access = await requireAccess();
  if (!canManageRegistry(access)) return NextResponse.redirect(new URL("/settings?analyticsError=denied", request.url));
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const clientId = process.env.ANALYTICS_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.ANALYTICS_GOOGLE_CLIENT_SECRET;
  if (!code || !state || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings?analyticsError=not_configured", request.url));
  }
  const redirectUri = new URL("/api/analytics/google/callback", process.env.AUTH_URL || url.origin).toString();
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: await verifierFor(state),
      }),
    });
    const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (!tokenResponse.ok || !token.access_token) {
      return NextResponse.redirect(new URL("/settings?analyticsError=oauth_failed", request.url));
    }
    await serviceTx((db) => exchangeOAuthState(db, {
      state,
      token: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
      },
    }));
    return NextResponse.redirect(new URL(`/settings?analyticsState=${encodeURIComponent(state)}`, request.url));
  } catch (error) {
    console.error("Analytics OAuth callback failed", { name: error instanceof Error ? error.name : "Error" });
    return NextResponse.redirect(new URL("/settings?analyticsError=oauth_failed", request.url));
  }
}

async function verifierFor(state: string): Promise<string> {
  return serviceTx(async (db) => {
    const { rows } = await db.query<{ code_verifier_ciphertext: string | null; code_verifier_nonce: string | null }>(
      "select code_verifier_ciphertext, code_verifier_nonce from analytics_oauth_states where state_hash = $1",
      [sha256(state)],
    );
    const row = rows[0];
    if (!row?.code_verifier_ciphertext || !row.code_verifier_nonce) throw new AnalyticsRuleError("This connection attempt has expired.");
    return decryptSecret(row.code_verifier_ciphertext, row.code_verifier_nonce);
  });
}
