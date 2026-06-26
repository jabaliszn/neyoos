import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { saveIntegrationCredential } from "../src/lib/services/integration-credentials.service";
import { sendBetterStackLog, sendPostHogEvent, sendSentryEvent } from "../src/lib/observability/vault-observability";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const vaultObs = readFileSync(join(process.cwd(), "src/lib/observability/vault-observability.ts"), "utf8");
  const capture = readFileSync(join(process.cwd(), "src/lib/observability/capture.ts"), "utf8");
  const analytics = readFileSync(join(process.cwd(), "src/lib/observability/analytics.ts"), "utf8");
  const registry = readFileSync(join(process.cwd(), "src/lib/services/integration-credentials.service.ts"), "utf8");

  assert(vaultObs.includes("sentry_dsn") && vaultObs.includes("better_stack_token") && vaultObs.includes("posthog_key"), "Observability helper reads Sentry, Better Stack and PostHog credentials from vault");
  assert(capture.includes("sendSentryEvent") && capture.includes("sendBetterStackLog"), "captureError/captureMessage send to Sentry and Better Stack seams");
  assert(analytics.includes("sendPostHogEvent"), "analytics track() sends to PostHog seam");
  assert(registry.includes("better_stack_ingest_url") && registry.includes("posthog_host"), "Integration vault includes optional Better Stack ingest URL and PostHog host");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(actor, "SUPER_ADMIN actor exists");
  const keys = ["sentry_dsn", "better_stack_token", "better_stack_ingest_url", "posthog_key", "posthog_host"];
  const old = await db.neyoIntegrationSecret.findMany({ where: { key: { in: keys } } });
  const originalFetch = global.fetch;
  try {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    await saveIntegrationCredential(actor!, { key: "sentry_dsn", value: "https://public@example.sentry.io/123" });
    await saveIntegrationCredential(actor!, { key: "better_stack_token", value: "better-token" });
    await saveIntegrationCredential(actor!, { key: "better_stack_ingest_url", value: "https://logs.example.test" });
    await saveIntegrationCredential(actor!, { key: "posthog_key", value: "phc_test" });
    await saveIntegrationCredential(actor!, { key: "posthog_host", value: "https://posthog.example.test" });

    const calls: any[] = [];
    global.fetch = (async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as any;

    const sentry = await sendSentryEvent({ level: "error", message: "Scale test error", context: { area: "i60" } });
    const better = await sendBetterStackLog({ level: "error", message: "Better log", context: { area: "i60" } });
    const posthog = await sendPostHogEvent("i60_test_event", { distinctId: "founder", area: "i60" });

    assert(sentry.sent && calls[0].url === "https://example.sentry.io/api/123/store/", "Sentry seam posts to DSN-derived store URL");
    assert(String(calls[0].init.headers["X-Sentry-Auth"]).includes("sentry_key=public"), "Sentry seam uses vault DSN public key");
    assert(better.sent && calls[1].url === "https://logs.example.test", "Better Stack seam posts to vault ingest URL");
    assert(calls[1].init.headers.Authorization === "Bearer better-token", "Better Stack seam uses vault token");
    assert(posthog.sent && calls[2].url === "https://posthog.example.test/capture/", "PostHog seam posts to vault host");
    const posthogPayload = JSON.parse(calls[2].init.body);
    assert(posthogPayload.api_key === "phc_test" && posthogPayload.event === "i60_test_event" && posthogPayload.distinct_id === "founder", "PostHog seam uses vault key and event payload");
  } finally {
    global.fetch = originalFetch;
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    for (const row of old) await db.neyoIntegrationSecret.create({ data: row as any });
  }

  console.log("\nI.60 Observability from Vault test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
