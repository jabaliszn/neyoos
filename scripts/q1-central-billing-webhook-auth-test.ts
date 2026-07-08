/**
 * Q.1 — Central billing webhook authentication, live-HTTP regression test.
 *
 * SECURITY CONTEXT: during a third-party-integrations audit (2026-07-03), a
 * REAL, exploitable vulnerability was found and fixed in
 * `POST /api/billing/central-callback` — this route activates a real
 * school's SaaS subscription (extends `currentPeriodEnd` by a real term,
 * flips `status` to ACTIVE) purely from an HTTP request body, with NO
 * authentication check at all. It was directly confirmed exploitable: an
 * unauthenticated `curl` POST with a forged `accountRef` genuinely extended
 * a real school's subscription for free, bypassing M-Pesa entirely. Fixed
 * by requiring the same shared `DARAJA_WEBHOOK_TOKEN` secret-path-token the
 * pre-existing per-tenant `/api/payments/webhook/[slug]` route already used.
 *
 * This script exercises the REAL route over REAL HTTP (not just the
 * service function directly) so this can never silently regress — a
 * service-level-only test would NOT have caught the original bug, since the
 * auth check lives in the route handler, not the service.
 *
 * Requires a real dev server already running on http://localhost:3000
 * (or override BASE_URL). Run: npx tsx scripts/q1-central-billing-webhook-auth-test.ts
 */
import { db } from "../src/lib/db";

const BASE = process.env.BASE_URL || "http://localhost:3000";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  \u2713 ${message}`);
}

async function main() {
  console.log("Q.1 Central billing webhook authentication — live HTTP test");

  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) {
    throw new Error(`Dev server not reachable at ${BASE} — start it first (npm run dev) before running this test.`);
  }

  const tenant = await db.tenant.findFirst({ where: { slug: "karibu-high" } });
  if (!tenant) throw new Error("Seed the DB first (karibu-high tenant not found).");

  const subBefore = await db.subscription.findUnique({ where: { tenantId: tenant.id } });
  if (!subBefore) throw new Error("karibu-high has no Subscription row to test against.");
  const originalPeriodEnd = subBefore.currentPeriodEnd;

  const forgedRef1 = `Q1-FORGED-${Date.now()}-A`;
  const forgedRef2 = `Q1-FORGED-${Date.now()}-B`;
  const createdPaymentIds: string[] = [];

  try {
    // ---- 1. No token at all: must be rejected ----
    const res1 = await fetch(`${BASE}/api/billing/central-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountRef: `NEYO-${tenant.slug.toUpperCase()}`, amount: 1, mpesaRef: forgedRef1 }),
    });
    assert(res1.status === 401, `a callback with NO token is rejected with 401 (got ${res1.status})`);
    const body1 = await res1.json().catch(() => ({}));
    assert(body1?.ResultCode === 1, "the 401 response uses Daraja's own real ack shape (ResultCode:1), not a generic error");

    const afterNoToken = await db.subscription.findUnique({ where: { tenantId: tenant.id } });
    assert(afterNoToken?.currentPeriodEnd.getTime() === originalPeriodEnd.getTime(), "the real subscription was NOT extended by the unauthenticated forged request");
    const forgedPayment1 = await db.subscriptionPayment.findUnique({ where: { mpesaRef: forgedRef1 } });
    assert(!forgedPayment1, "no SubscriptionPayment row was created from the unauthenticated forged request");

    // ---- 2. Wrong token: must be rejected ----
    const res2 = await fetch(`${BASE}/api/billing/central-callback?t=totally-wrong-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountRef: `NEYO-${tenant.slug.toUpperCase()}`, amount: 1, mpesaRef: forgedRef2 }),
    });
    assert(res2.status === 401, `a callback with the WRONG token is rejected with 401 (got ${res2.status})`);

    // ---- 3. Correct token: must be accepted (this is what the real Daraja portal will call) ----
    const expectedToken = process.env.DARAJA_WEBHOOK_TOKEN || "dev-webhook-token";
    const legitRef = `Q1-LEGIT-${Date.now()}`;
    const res3 = await fetch(`${BASE}/api/billing/central-callback?t=${encodeURIComponent(expectedToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountRef: `NEYO-${tenant.slug.toUpperCase()}`, amount: 1, mpesaRef: legitRef }),
    });
    assert(res3.ok, `a callback with the CORRECT token is accepted (got ${res3.status})`);
    const body3 = await res3.json();
    assert(body3?.ok === true && body3?.data?.status === "PAID", "the correctly-authenticated callback genuinely processes the payment");
    const legitPayment = await db.subscriptionPayment.findUnique({ where: { mpesaRef: legitRef } });
    assert(!!legitPayment, "a real SubscriptionPayment row was created for the correctly-authenticated callback");
    if (legitPayment) createdPaymentIds.push(legitPayment.id);

    // ---- 4. The URL the app itself generates for Daraja to call MUST include the token ----
    const { getCentralBillingGatewayStatus } = await import("../src/lib/services/central-billing.service");
    const status = await getCentralBillingGatewayStatus();
    assert(status.callbackUrl.includes("?t="), "the real callback URL the app tells NEYO Ops/Daraja to use includes the auth token query param");

    console.log("\n\u2705 Q.1 Central billing webhook authentication test passed — the real vulnerability is fixed and will not silently regress");
  } finally {
    for (const id of createdPaymentIds) {
      await db.subscriptionPayment.delete({ where: { id } }).catch(() => {});
    }
    await db.subscription.update({ where: { tenantId: tenant.id }, data: { currentPeriodEnd: originalPeriodEnd } }).catch(() => {});
    const finalCheck = await db.subscription.findUnique({ where: { tenantId: tenant.id } });
    console.log(`  cleanup \u2713 (test payment rows removed, subscription restored to ${finalCheck?.currentPeriodEnd.toISOString()})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
