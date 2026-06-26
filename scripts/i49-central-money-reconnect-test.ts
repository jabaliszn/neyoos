import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { initiateCentralSubscriptionStk, handleCentralSubscriptionCallback, centralAccountRef } from "../src/lib/services/central-billing.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260624172000_i49_central_subscription_money/migration.sql"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/central-billing.service.ts"), "utf8");
  const publicStk = readFileSync(join(process.cwd(), "src/app/api/billing/public-stk/route.ts"), "utf8");
  const callback = readFileSync(join(process.cwd(), "src/app/api/billing/central-callback/route.ts"), "utf8");
  const expiredUi = readFileSync(join(process.cwd(), "src/components/public-site/expired-checkout-client.tsx"), "utf8");
  const founderUi = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");

  assert(schema.includes("checkoutRequestId String?      @unique") && schema.includes("accountRef") && schema.includes("central_mpesa_stk"), "SubscriptionPayment stores central checkout/account reference fields");
  assert(migration.includes("SubscriptionPayment_checkoutRequestId_key"), "Migration adds unique checkoutRequestId for central subscription payments");
  assert(service.includes("centralAccountRef") && service.includes("billing.central_payment_reconnected"), "Central billing service owns account references and reconnect audit");
  assert(publicStk.includes("initiateCentralSubscriptionStk") && publicStk.includes("centralized: true"), "Expired-account STK endpoint uses central NEYO billing service");
  assert(callback.includes("handleCentralSubscriptionCallback"), "Central callback endpoint handles instant reconnect callbacks");
  assert(expiredUi.includes("NEYO central billing") && expiredUi.includes("automatically reconnect"), "Expired checkout UI explains central instant reconnect");
  assert(founderUi.includes("Central NEYO money account") && founderUi.includes("/api/billing/central-callback"), "Founder Ops states subscription money lands centrally");

  const tenant = await db.tenant.findFirst({ orderBy: { onboardedAt: "asc" } });
  assert(tenant, "Tenant exists for central billing test");
  const oldSub = await db.subscription.findUnique({ where: { tenantId: tenant!.id } });
  const oldPaymentIds = new Set((await db.subscriptionPayment.findMany({ where: { tenantId: tenant!.id }, select: { id: true } })).map((p) => p.id));
  const genericBefore = await db.payment.count({ where: { tenantId: tenant!.id } });

  try {
    await db.subscription.upsert({
      where: { tenantId: tenant!.id },
      create: { tenantId: tenant!.id, planKey: "pro", status: "SUSPENDED", grandfatheredPrice: 9000, currentPeriodEnd: new Date(Date.now() - 24 * 3600_000) },
      update: { planKey: "pro", status: "SUSPENDED", grandfatheredPrice: 9000, graceEndsAt: null },
    });

    const stk = await initiateCentralSubscriptionStk({ tenantId: tenant!.id, phone: "+254700111222" });
    assert(stk.accountRef === centralAccountRef(tenant!.slug) && stk.checkoutRequestId, "Central STK creates NEYO account reference and checkout id");
    const pending = await db.subscriptionPayment.findUnique({ where: { checkoutRequestId: stk.checkoutRequestId } });
    assert(pending?.method === "central_mpesa_stk" && pending.status === "PENDING", "Central STK is recorded as a SubscriptionPayment, not school fee payment");
    const genericAfter = await db.payment.count({ where: { tenantId: tenant!.id } });
    assert(genericAfter === genericBefore, "Central subscription STK does not create a tenant school-fee Payment row");

    const reconnected = await handleCentralSubscriptionCallback({ checkoutRequestId: stk.checkoutRequestId, success: true, mpesaRef: "CENTRAL-I49-STK" });
    const activeSub = await db.subscription.findUnique({ where: { tenantId: tenant!.id } });
    assert(reconnected.matched && activeSub?.status === "ACTIVE" && !activeSub.graceEndsAt, "STK callback instantly reconnects suspended school subscription");

    await db.subscription.update({ where: { tenantId: tenant!.id }, data: { status: "SUSPENDED", graceEndsAt: null } });
    const outside = await handleCentralSubscriptionCallback({ accountRef: centralAccountRef(tenant!.slug), success: true, mpesaRef: "CENTRAL-I49-C2B", amount: 9000, phone: "+254700111222" });
    const activeAgain = await db.subscription.findUnique({ where: { tenantId: tenant!.id } });
    assert(outside.matched && activeAgain?.status === "ACTIVE", "Outside-NEYO Paybill callback matches accountRef and reconnects automatically");

    const audit = await db.auditLog.findFirst({ where: { tenantId: tenant!.id, action: "billing.central_payment_reconnected" } });
    assert(audit?.metadata?.includes("centralized") && audit.metadata.includes("reconnected"), "Central reconnect is audit logged");
  } finally {
    const afterIds = await db.subscriptionPayment.findMany({ where: { tenantId: tenant!.id }, select: { id: true } });
    await db.subscriptionPayment.deleteMany({ where: { tenantId: tenant!.id, id: { in: afterIds.map((p) => p.id).filter((id) => !oldPaymentIds.has(id)) } } });
    if (oldSub) {
      await db.subscription.update({ where: { tenantId: tenant!.id }, data: { planKey: oldSub.planKey, status: oldSub.status, grandfatheredPrice: oldSub.grandfatheredPrice, addOns: oldSub.addOns, currentPeriodStart: oldSub.currentPeriodStart, currentPeriodEnd: oldSub.currentPeriodEnd, graceEndsAt: oldSub.graceEndsAt } });
    } else {
      await db.subscription.deleteMany({ where: { tenantId: tenant!.id } });
    }
  }

  console.log("\nI.49 Central Money + Instant Reconnect checkpoint test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
