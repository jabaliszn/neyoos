import { db } from "../src/lib/db";
import { saveIntegrationCredential } from "../src/lib/services/integration-credentials.service";
import { completeOAuthCallback, startOAuthLink } from "../src/lib/services/oauth-vault.service";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}
function asUser(user: any) { return { id: user.id, tenantId: user.tenantId, neyoLoginId: user.neyoLoginId, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role, secondaryRole: user.secondaryRole, language: user.language || "en" }; }

async function main() {
  const service = readFileSync(join(process.cwd(), "src/lib/services/oauth-vault.service.ts"), "utf8");
  assert(service.includes("exchangeCodeForProfile") && service.includes("tokenUrl") && service.includes("userInfoUrl"), "OAuth service has live token/profile exchange logic");
  assert(service.includes("oAuthConnectedAccount.upsert") && service.includes("oauth.connected"), "OAuth callback upserts connected account and audits connection");
  assert(!service.includes("linked: false, reason"), "OAuth callback no longer leaves token/profile exchange as placeholder");

  const user = await db.user.findFirst({ where: { isActive: true } });
  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } }) || user;
  assert(user && actor, "User and SUPER_ADMIN actor exist");
  const keys = ["oauth_google_client_id", "oauth_google_client_secret"];
  const oldSecrets = await db.neyoIntegrationSecret.findMany({ where: { key: { in: keys } } });
  const oldAccounts = await db.oAuthConnectedAccount.findMany({ where: { userId: user!.id } });
  const oldStates = await db.oAuthState.findMany({ where: { userId: user!.id } });
  const originalFetch = global.fetch;
  try {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    await db.oAuthConnectedAccount.deleteMany({ where: { userId: user!.id, provider: "google" } });
    await db.oAuthState.deleteMany({ where: { userId: user!.id } });
    await saveIntegrationCredential(actor!, { key: "oauth_google_client_id", value: "google-client-id" });
    await saveIntegrationCredential(actor!, { key: "oauth_google_client_secret", value: "google-secret" });
    const started = await startOAuthLink(asUser(user), "google", "/settings/security");

    const calls: any[] = [];
    global.fetch = (async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "google-access-token", id_token: "unused" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (String(url).includes("openidconnect.googleapis.com")) {
        return new Response(JSON.stringify({ sub: "google-sub-123", email: "principal@karibuhigh.ac.ke", name: "Wanjiru Kamau" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("{}", { status: 404 });
    }) as any;

    const result = await completeOAuthCallback({ provider: "google", state: started.state, code: "auth-code" });
    assert(result.linked === true && result.provider === "google", "OAuth callback returns linked=true after provider profile exchange");
    assert(calls[0].url === "https://oauth2.googleapis.com/token" && String(calls[0].init.body).includes("client_secret=google-secret"), "OAuth callback exchanges code using vault client secret");
    assert(calls[1].init.headers.Authorization === "Bearer google-access-token", "OAuth callback fetches provider profile with access token");
    const account = await db.oAuthConnectedAccount.findUnique({ where: { userId_provider: { userId: user!.id, provider: "google" } } });
    assert(account?.providerAccountId === "google-sub-123" && account.email === "principal@karibuhigh.ac.ke", "OAuth connected account is stored with provider profile");
    const audit = await db.auditLog.findFirst({ where: { entityType: "OAuthConnectedAccount", entityId: account!.id, action: "oauth.connected" } });
    assert(audit, "OAuth connection is audit logged");
  } finally {
    global.fetch = originalFetch;
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    for (const row of oldSecrets) await db.neyoIntegrationSecret.create({ data: row as any });
    await db.oAuthConnectedAccount.deleteMany({ where: { userId: user!.id } });
    for (const row of oldAccounts) await db.oAuthConnectedAccount.create({ data: row as any });
    await db.oAuthState.deleteMany({ where: { userId: user!.id } });
    for (const row of oldStates) await db.oAuthState.create({ data: row as any });
  }

  console.log("\nI.60 OAuth Live Token/Profile Exchange test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
