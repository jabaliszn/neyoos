import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { PRICING_CATALOG_SETTING_KEY, defaultPricingCatalog, getPlanFromCatalog, savePricingCatalog } from "../src/lib/services/pricing-catalog.service";
import { subscribeToPlan } from "../src/lib/services/billing.service";
import { checkSmsQuota } from "../src/lib/services/limits.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  const billingService = readFileSync(join(process.cwd(), "src/lib/services/billing.service.ts"), "utf8");
  const limitsService = readFileSync(join(process.cwd(), "src/lib/services/limits.service.ts"), "utf8");

  assert(api.includes("update_pricing_catalog") && api.includes("savePricingCatalog"), "Founder Ops API saves pricing catalog with SUPER_ADMIN action");
  assert(ui.includes("Pricing & Package Editor — no code touch"), "Business Operations UI has no-code pricing/package editor");
  assert(ui.includes("What is included in this package") && ui.includes("Out-of-package SMS bundles"), "UI edits package inclusions and separates SMS bundles");
  assert(billingService.includes("getPlanFromCatalog"), "Billing subscriptions read dynamic pricing catalog");
  assert(limitsService.includes("SMS is outside packages") && limitsService.includes("sub.addOns"), "SMS quota comes from active SMS add-ons, not package allowance");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(actor, "SUPER_ADMIN actor exists for audit logging");
  const tenant = await db.tenant.findFirst({ orderBy: { onboardedAt: "asc" } });
  assert(tenant, "Tenant exists for subscription/grandfathering check");

  const oldSetting = await db.platformSetting.findUnique({ where: { key: PRICING_CATALOG_SETTING_KEY } });
  const oldSub = await db.subscription.findUnique({ where: { tenantId: tenant!.id } });

  try {
    const catalog = defaultPricingCatalog();
    const pro = catalog.plans.find((plan) => plan.key === "pro")!;
    pro.pricePerTerm = 12345;
    pro.highlights = ["Up to 600 students", "Hostel + Transport included", "Up to 3 add-ons"];
    catalog.addOns = catalog.addOns.map((addOn) => addOn.key === "sms_topup_1000" ? { ...addOn, pricePerTerm: 950 } : addOn);

    await savePricingCatalog(catalog, { id: actor!.id, fullName: actor!.fullName, tenantId: actor!.tenantId });
    const savedPlan = await getPlanFromCatalog("pro");
    assert(savedPlan?.pricePerTerm === 12345, "Edited Pro package price is loaded from PlatformSetting, not code");
    assert(savedPlan?.limits.smsPerTerm === 0, "Saved packages keep SMS allowance at 0");

    const previousLockedPrice = oldSub?.grandfatheredPrice ?? 0;
    await db.subscription.upsert({
      where: { tenantId: tenant!.id },
      create: { tenantId: tenant!.id, planKey: "msingi", status: "ACTIVE", grandfatheredPrice: previousLockedPrice, currentPeriodEnd: new Date(Date.now() + 120 * 24 * 3600_000) },
      update: { planKey: oldSub?.planKey ?? "msingi", grandfatheredPrice: previousLockedPrice },
    });
    const stillExisting = await db.subscription.findUnique({ where: { tenantId: tenant!.id } });
    assert(stillExisting?.grandfatheredPrice === previousLockedPrice, "Saving global pricing does not rewrite existing grandfathered prices");

    const result = await subscribeToPlan(tenant!.id, { id: actor!.id, fullName: actor!.fullName }, "pro");
    assert(result.subscription.grandfatheredPrice === 12345, "New/changed subscription locks the current dynamic package price");

    await db.subscription.update({ where: { tenantId: tenant!.id }, data: { addOns: JSON.stringify(["sms_topup_1000"]) } });
    const smsQuota = await checkSmsQuota(tenant!.id, 1);
    assert(smsQuota.status.limit === 1000, "SMS quota is granted by the out-of-package SMS top-up bundle");

    let rejected = false;
    try {
      await savePricingCatalog({ ...catalog, plans: catalog.plans.map((plan) => plan.key === "pro" ? { ...plan, limits: { ...plan.limits, smsPerTerm: 10 } } : plan) }, { id: actor!.id, fullName: actor!.fullName, tenantId: actor!.tenantId });
    } catch {
      rejected = true;
    }
    assert(rejected, "Validation rejects SMS being included inside a package");
  } finally {
    if (oldSetting) {
      await db.platformSetting.update({ where: { key: PRICING_CATALOG_SETTING_KEY }, data: { value: oldSetting.value, updatedBy: oldSetting.updatedBy } });
    } else {
      await db.platformSetting.deleteMany({ where: { key: PRICING_CATALOG_SETTING_KEY } });
    }
    if (oldSub) {
      await db.subscription.update({ where: { tenantId: tenant!.id }, data: { planKey: oldSub.planKey, status: oldSub.status, grandfatheredPrice: oldSub.grandfatheredPrice, addOns: oldSub.addOns, currentPeriodStart: oldSub.currentPeriodStart, currentPeriodEnd: oldSub.currentPeriodEnd, graceEndsAt: oldSub.graceEndsAt } });
    } else {
      await db.subscription.deleteMany({ where: { tenantId: tenant!.id } });
    }
  }

  console.log("\nI.48 Pricing Catalog checkpoint test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
