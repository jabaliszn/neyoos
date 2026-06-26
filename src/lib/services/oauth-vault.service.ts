import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { appBaseUrl } from "@/lib/notifications/email";
import { readCompanySecret } from "@/lib/services/company-secret.service";
import type { SessionUser } from "@/lib/core/session";

export const oauthProviderSchema = z.enum(["google", "apple", "microsoft"]);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

type ProviderProfile = { id: string; email?: string | null; name?: string | null };

const PROVIDERS: Record<OAuthProvider, { authUrl: string; scope: string; clientIdKey: string; clientSecretKey: string; tokenUrl: string; userInfoUrl?: string }> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    clientIdKey: "oauth_google_client_id",
    clientSecretKey: "oauth_google_client_secret",
  },
  apple: {
    authUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
    scope: "name email",
    clientIdKey: "oauth_apple_client_id",
    clientSecretKey: "oauth_apple_client_secret",
  },
  microsoft: {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
    scope: "openid email profile User.Read",
    clientIdKey: "oauth_microsoft_client_id",
    clientSecretKey: "oauth_microsoft_client_secret",
  },
};

async function providerCredentials(provider: OAuthProvider) {
  const cfg = PROVIDERS[provider];
  const clientId = await readCompanySecret(cfg.clientIdKey);
  const clientSecret = await readCompanySecret(cfg.clientSecretKey);
  if (!clientId || !clientSecret) throw new Error(`${provider} OAuth credentials are not configured in NEYO Ops.`);
  return { cfg, clientId, clientSecret };
}

function decodeJwtPayload(token?: string | null): Record<string, any> | null {
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function exchangeCodeForProfile(provider: OAuthProvider, code: string): Promise<ProviderProfile> {
  const { cfg, clientId, clientSecret } = await providerCredentials(provider);
  const redirectUri = `${appBaseUrl()}/api/oauth/callback/${provider}`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  const tokenJson = await tokenRes.json().catch(() => ({} as any));
  if (!tokenRes.ok || (!tokenJson.access_token && !tokenJson.id_token)) {
    throw new Error(tokenJson.error_description || tokenJson.error || `${provider} token exchange failed.`);
  }

  if (provider === "apple") {
    const payload = decodeJwtPayload(tokenJson.id_token);
    const sub = payload?.sub;
    if (!sub) throw new Error("Apple did not return a subject identifier.");
    return { id: String(sub), email: payload?.email || null, name: payload?.name || payload?.email || null };
  }

  if (cfg.userInfoUrl && tokenJson.access_token) {
    const profileRes = await fetch(cfg.userInfoUrl, { headers: { Authorization: `Bearer ${tokenJson.access_token}`, Accept: "application/json" } });
    const profile = await profileRes.json().catch(() => ({} as any));
    if (!profileRes.ok) throw new Error(profile.error_description || profile.error || `${provider} profile fetch failed.`);
    const id = profile.sub || profile.id;
    if (!id) throw new Error(`${provider} did not return a stable account id.`);
    return { id: String(id), email: profile.email || profile.preferred_username || profile.upn || null, name: profile.name || profile.displayName || null };
  }

  const payload = decodeJwtPayload(tokenJson.id_token);
  if (payload?.sub) return { id: String(payload.sub), email: payload.email || null, name: payload.name || null };
  throw new Error(`${provider} did not return a usable profile.`);
}

export async function oauthProviderStatus(user: SessionUser) {
  const accounts = await db.oAuthConnectedAccount.findMany({ where: { userId: user.id } });
  const statuses = await Promise.all((Object.keys(PROVIDERS) as OAuthProvider[]).map(async (provider) => {
    const cfg = PROVIDERS[provider];
    const clientId = await readCompanySecret(cfg.clientIdKey);
    const clientSecret = await readCompanySecret(cfg.clientSecretKey);
    const account = accounts.find((a) => a.provider === provider);
    return { provider, configured: Boolean(clientId && clientSecret), connected: Boolean(account), email: account?.email || null, displayName: account?.displayName || null, linkedAt: account?.linkedAt || null };
  }));
  return statuses;
}

export async function startOAuthLink(user: SessionUser, provider: OAuthProvider, redirectTo = "/settings/security") {
  const { cfg, clientId } = await providerCredentials(provider);
  const state = crypto.randomBytes(24).toString("hex");
  await db.oAuthState.create({ data: { state, provider, tenantId: user.tenantId, userId: user.id, redirectTo, expiresAt: new Date(Date.now() + 10 * 60_000) } });
  const url = new URL(cfg.authUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${appBaseUrl()}/api/oauth/callback/${provider}`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("state", state);
  if (provider === "apple") url.searchParams.set("response_mode", "form_post");
  return { authUrl: url.toString(), state, provider };
}

export async function disconnectOAuth(user: SessionUser, provider: OAuthProvider) {
  await db.oAuthConnectedAccount.deleteMany({ where: { userId: user.id, provider } });
  await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "oauth.disconnected", entityType: "OAuthConnectedAccount", metadata: JSON.stringify({ provider }) } });
  return { success: true };
}

export async function completeOAuthCallback(input: { provider: OAuthProvider; state: string; code: string }) {
  const row = await db.oAuthState.findUnique({ where: { state: input.state } });
  if (!row || row.provider !== input.provider || row.expiresAt < new Date()) throw new Error("OAuth state expired or invalid.");
  if (!input.code) throw new Error("OAuth provider did not return an authorization code.");

  const profile = await exchangeCodeForProfile(input.provider, input.code);
  const linked = await db.oAuthConnectedAccount.upsert({
    where: { userId_provider: { userId: row.userId, provider: input.provider } },
    create: { tenantId: row.tenantId, userId: row.userId, provider: input.provider, providerAccountId: profile.id, email: profile.email || null, displayName: profile.name || null },
    update: { providerAccountId: profile.id, email: profile.email || null, displayName: profile.name || null, lastUsedAt: new Date() },
  });
  await db.oAuthState.delete({ where: { state: input.state } }).catch(() => {});
  await db.auditLog.create({ data: { tenantId: row.tenantId, actorId: row.userId, actorName: "OAuth", action: "oauth.connected", entityType: "OAuthConnectedAccount", entityId: linked.id, metadata: JSON.stringify({ provider: input.provider, email: profile.email, displayName: profile.name }) } });
  return { redirectTo: row.redirectTo || "/settings/security", linked: true, provider: input.provider };
}
