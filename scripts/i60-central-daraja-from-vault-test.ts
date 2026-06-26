import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { getCentralBillingGatewayStatus, handleCentralSubscriptionCallback } from "../src/lib/services/central-billing.service";
import { saveIntegrationCredential } from "../src/lib/services/integration-credentials.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const central = readFileSync(join(process.cwd(), "src/lib/services/central-billing.service.ts"), "utf8");
  const provider = readFileSync(join(process.cwd(), "src/lib/payments/daraja-provider.ts"), "utf8");
  const vault = readFileSync(join(process.cwd(), "src/lib/services/integration-credentials.service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/billing/central-callback/route.ts"), "utf8");

  assert(central.includes("readCompanySecret") && central.includes("central_daraja_consumer_key") && central.includes("central_daraja_passkey"), "Central billing reads Daraja credentials from NEYO Ops encrypted vault");
  assert(central.includes("new DarajaProvider") && central.includes("provider.stkPush") && central.includes("source: gateway.source"), "Central billing switches to DarajaProvider and records credential source");
  assert(central.includes("/api/billing/central-callback") && provider.includes("input.callbackUrl"), "Central STK uses central callback URL override");
  assert(central.includes("daraja.parseCallback") && api.includes("handleCentralSubscriptionCallback"), "Central callback can parse Daraja STK callback shape");
  assert(vault.includes("central_daraja_environment") && vault.includes("central_daraja_shortcode"), "Integration vault includes Daraja environment and shortcode entries");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  const tenant = await db.tenant.findFirst({ orderBy: { onboardedAt: "asc" } });
  assert(actor && tenant, "SUPER_ADMIN and tenant exist");

  const keys = ["central_daraja_shortcode", "central_daraja_environment", "central_daraja_consumer_key", "central_daraja_consumer_secret", "central_daraja_passkey"];
  const oldSecrets = await db.neyoIntegrationSecret.findMany({ where: { key: { in: keys } } });
  const oldSub = await db.subscription.findUnique({ where: { tenantId: tenant!.id } });
  const oldPaymentIds = new Set((await db.subscriptionPayment.findMany({ where: { tenantId: tenant!.id }, select: { id: true } })).map((p) => p.id));

  try {
    for (const [key, value] of [
      ["central_daraja_shortcode", "174379"],
      ["central_daraja_environment", "sandbox"],
      ["central_daraja_consumer_key", "consumer-key"],
      ["central_daraja_consumer_secret", "consumer-secret"],
      ["central_daraja_passkey", "passkey"],
    ] as const) {
      await saveIntegrationCredential(actor!, { key, value });
    }
    const status = await getCentralBillingGatewayStatus();
    assert(status.source === "neyo_ops_vault" && status.configured === 5 && status.callbackUrl.includes("/api/billing/central-callback"), "Gateway status reports NEYO Ops vault credentials and central callback URL");

    await db.subscription.upsert({ where: { tenantId: tenant!.id }, create: { tenantId: tenant!.id, planKey: "pro", status: "SUSPENDED", grandfatheredPrice: 9000, currentPeriodEnd: new Date(Date.now() - 86400000) }, update: { status: "SUSPENDED", graceEndsAt: null, grandfatheredPrice: 9000 } });
    const sub = await db.subscription.findUniqueOrThrow({ where: { tenantId: tenant!.id } });
    const payment = await db.subscriptionPayment.create({ data: { subscriptionId: sub.id, tenantId: tenant!.id, amount: 9000, status: "PENDING", method: "central_mpesa_stk", phone: "+254700111222", accountRef: `NEYO-${tenant!.slug.toUpperCase()}`.slice(0,20), checkoutRequestId: "ws_CO_12345", periodStart: new Date(), periodEnd: new Date(Date.now() + 120*86400000) } });
    const cb = { Body: { stkCallback: { CheckoutRequestID: "ws_CO_12345", ResultCode: 0, ResultDesc: "The service request is processed successfully.", CallbackMetadata: { Item: [{ Name: "MpesaReceiptNumber", Value: "RKT123456" }] } } } };
    const result = await handleCentralSubscriptionCallback(cb);
    const active = await db.subscription.findUnique({ where: { tenantId: tenant!.id } });
    assert(result.matched && active?.status === "ACTIVE", "Daraja-shaped central callback auto-reconnects subscription");
    const paid = await db.subscriptionPayment.findUnique({ where: { id: payment.id } });
    assert(paid?.status === "PAID" && paid.mpesaRef === "RKT123456", "Daraja-shaped central callback marks SubscriptionPayment paid with receipt number");
  } finally {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    for (const row of oldSecrets) await db.neyoIntegrationSecret.create({ data: row as any });
    const afterIds = await db.subscriptionPayment.findMany({ where: { tenantId: tenant!.id }, select: { id: true } });
    await db.subscriptionPayment.deleteMany({ where: { tenantId: tenant!.id, id: { in: afterIds.map((p) => p.id).filter((id) => !oldPaymentIds.has(id)) } } });
    if (oldSub) await db.subscription.update({ where: { tenantId: tenant!.id }, data: { planKey: oldSub.planKey, status: oldSub.status, grandfatheredPrice: oldSub.grandfatheredPrice, addOns: oldSub.addOns, currentPeriodStart: oldSub.currentPeriodStart, currentPeriodEnd: oldSub.currentPeriodEnd, graceEndsAt: oldSub.graceEndsAt } });
  }

  console.log("\nI.60 Central Daraja from NEYO Ops Vault test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
