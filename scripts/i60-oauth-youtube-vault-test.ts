import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { saveIntegrationCredential } from "../src/lib/services/integration-credentials.service";
import { oauthProviderStatus, startOAuthLink, disconnectOAuth } from "../src/lib/services/oauth-vault.service";
import { searchLearningVideos } from "../src/lib/services/learning-video.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}
function asUser(user: any) { return { id: user.id, tenantId: user.tenantId, neyoLoginId: user.neyoLoginId, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role, secondaryRole: user.secondaryRole, language: user.language || "en" }; }

async function main() {
  const oauthService = readFileSync(join(process.cwd(), "src/lib/services/oauth-vault.service.ts"), "utf8");
  const connectedUi = readFileSync(join(process.cwd(), "src/components/settings/connected-accounts-card.tsx"), "utf8");
  const learning = readFileSync(join(process.cwd(), "src/lib/services/learning-video.service.ts"), "utf8");
  const guide = readFileSync(join(process.cwd(), "docs/INTEGRATION-KEYS-GUIDE.md"), "utf8");
  const vault = readFileSync(join(process.cwd(), "src/lib/services/integration-credentials.service.ts"), "utf8");

  assert(oauthService.includes("clientIdKey") && oauthService.includes("oAuthState.create") && oauthService.includes("startOAuthLink"), "OAuth service reads provider credentials from vault and creates state");
  assert(connectedUi.includes("/api/oauth/status") && connectedUi.includes("/api/oauth/start") && connectedUi.includes("/api/oauth/disconnect"), "Connected accounts UI uses real OAuth APIs instead of fake local state");
  assert(learning.includes("readCompanySecret(\"youtube_api_key\")"), "Learning videos reads YouTube API key from NEYO Ops vault");
  assert(vault.includes("youtube_api_key"), "Integration vault includes YouTube API key");
  assert(guide.includes("youtube_api_key") && guide.includes("oauth_google_client_id") && guide.includes("/api/oauth/callback/google"), "Integration guide explains where to get YouTube and OAuth keys");

  const user = await db.user.findFirst({ where: { isActive: true } });
  assert(user, "User exists");
  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } }) || user;
  const keys = ["oauth_google_client_id", "oauth_google_client_secret", "youtube_api_key"];
  const old = await db.neyoIntegrationSecret.findMany({ where: { key: { in: keys } } });
  const oldStates = await db.oAuthState.findMany({ where: { userId: user!.id } });
  try {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    await db.oAuthState.deleteMany({ where: { userId: user!.id } });
    let status = await oauthProviderStatus(asUser(user));
    assert(status.find((p) => p.provider === "google")?.configured === false, "Google OAuth starts unconfigured without vault keys");
    await saveIntegrationCredential(actor!, { key: "oauth_google_client_id", value: "google-client-id" });
    await saveIntegrationCredential(actor!, { key: "oauth_google_client_secret", value: "google-secret" });
    status = await oauthProviderStatus(asUser(user));
    assert(status.find((p) => p.provider === "google")?.configured === true, "Google OAuth becomes configured after vault credentials are saved");
    const started = await startOAuthLink(asUser(user), "google", "/settings/security");
    assert(started.authUrl.includes("accounts.google.com") && started.authUrl.includes("client_id=google-client-id") && decodeURIComponent(started.authUrl).includes("/api/oauth/callback/google"), "OAuth start builds real Google authorization URL using vault client ID");
    const state = await db.oAuthState.findUnique({ where: { state: started.state } });
    assert(state?.provider === "google" && state.userId === user!.id, "OAuth start stores signed-in state row");
    await disconnectOAuth(asUser(user), "google");

    await saveIntegrationCredential(actor!, { key: "youtube_api_key", value: "YT-KEY" });
    const originalFetch = global.fetch;
    let capturedUrl = "";
    global.fetch = (async (url: any) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as any;
    const result = await searchLearningVideos(asUser(user), "cbc maths");
    global.fetch = originalFetch;
    assert(result.youtubeSearchConfigured === true && capturedUrl.includes("key=YT-KEY") && capturedUrl.includes("safeSearch=strict"), "YouTube search uses vault API key and safe education filters");
  } finally {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    for (const row of old) await db.neyoIntegrationSecret.create({ data: row as any });
    await db.oAuthState.deleteMany({ where: { userId: user!.id } });
    for (const row of oldStates) await db.oAuthState.create({ data: row as any });
  }

  console.log("\nI.60 OAuth + YouTube Vault test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
