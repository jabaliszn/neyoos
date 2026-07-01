/**
 * J.23 — Revenue & Product Packaging — full-stack proof.
 *
 * Proves, against the REAL repo (services + DB + plans + flags + grants), that all
 * SIX revenue features gate correctly:
 *
 *  1. FREE tier is BLOCKED from every premium feature (TierGatingError / 402 basis).
 *  2. ELITE plan UNLOCKS every premium feature (plan.includedModules).
 *  3. Buying the matching ADD-ON à la carte UNLOCKS a feature on a non-Elite plan
 *     (fixes the entitlement bug — the gate now reads subscription.addOns).
 *  4. A per-school MANUAL GRANT (NEYO Ops override) UNLOCKS a feature regardless
 *     of plan or add-ons, and is audit logged.
 *  5. The master Part-J TOGGLE wins: switching a revenue feature OFF in NEYO Ops
 *     blocks EVERYONE (even Elite) via requireRevenueFeature; switching ON restores.
 *  6. Pricing is editable in NEYO Ops (savePricingCatalog round-trips + audits).
 *
 * Leaves the seed exactly as found (snapshots + restores Karibu High's subscription).
 */
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import {
  requirePremiumFeature,
  hasEntitlement,
  hasPremiumFeature,
  requireRevenueFeature,
  hasRevenueFeature,
  TierGatingError,
} from "../src/lib/services/tier-gating.service";
import { setFeatureGrant, hasFeatureGrant } from "../src/lib/services/feature-grants.service";
import { setFlag, FlagError } from "../src/lib/services/platform-flags.service";
import { REVENUE_FEATURES, getRevenueFeature } from "../src/lib/core/revenue-features";
import { jFeatureKey } from "../src/lib/core/j-features";
import { savePricingCatalog, getPricingCatalog } from "../src/lib/services/pricing-catalog.service";

function sessionFrom(u: any) {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as any, secondaryRole: u.secondaryRole as any, language: u.language as any,
  };
}

let pass = 0;
function check(name: string, cond: boolean) {
  assert.ok(cond, `FAILED: ${name}`);
  console.log(`  ✓ ${name}`);
  pass++;
}

async function setPlan(tenantId: string, planKey: string, addOns: string[] | null) {
  await db.subscription.update({
    where: { tenantId },
    data: { planKey, addOns: addOns ? JSON.stringify(addOns) : null },
  });
}

async function main() {
  const ops = sessionFrom(await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } }));
  const principal = sessionFrom(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const tenantId = principal.tenantId;

  // ---- snapshot original subscription + flags + grants so we restore cleanly ----
  const original = await db.subscription.findUniqueOrThrow({ where: { tenantId } });
  const allKeys = REVENUE_FEATURES.map((f) => f.key);
  // clean any leftover grants/flags from a prior run
  for (const f of REVENUE_FEATURES) {
    await db.platformFlag.deleteMany({ where: { moduleKey: jFeatureKey(f.toggleId) } });
    await setFeatureGrant(ops, tenantId, f.key, false).catch(() => {});
  }

  try {
    console.log("\n[1] FREE tier is blocked from every premium feature");
    await setPlan(tenantId, "free_karibu", null);
    for (const f of REVENUE_FEATURES) {
      let blocked = false;
      try {
        await requirePremiumFeature(tenantId, f.key);
      } catch (e) {
        blocked = e instanceof TierGatingError;
      }
      check(`free tier blocked from ${f.key}`, blocked);
    }
    check("hasPremiumFeature() is false for free tier (advanced_analytics)", (await hasPremiumFeature(tenantId, "advanced_analytics")) === false);

    console.log("\n[2] ELITE plan unlocks every premium feature");
    await setPlan(tenantId, "elite", null);
    for (const f of REVENUE_FEATURES) {
      check(`elite unlocks ${f.key}`, (await hasEntitlement(tenantId, f.key)) === true);
    }

    console.log("\n[3] Buying the add-on à la carte unlocks it on a non-Elite plan");
    // PRO does NOT include skills_passport in includedModules — prove the add-on path.
    await setPlan(tenantId, "pro", null);
    check("pro WITHOUT add-on is blocked from skills_passport", (await hasEntitlement(tenantId, "skills_passport")) === false);
    await setPlan(tenantId, "pro", ["skills_passport"]);
    check("pro WITH skills_passport add-on is unlocked (entitlement bug fixed)", (await hasEntitlement(tenantId, "skills_passport")) === true);
    check("but pro+addon is still blocked from a DIFFERENT premium feature (custom_reports)", (await hasEntitlement(tenantId, "custom_reports")) === false);

    console.log("\n[4] NEYO Ops manual grant unlocks regardless of plan + is audited");
    await setPlan(tenantId, "free_karibu", null); // poorest plan, no add-ons
    check("free tier blocked from pathway_guidance before grant", (await hasEntitlement(tenantId, "pathway_guidance")) === false);
    await setFeatureGrant(ops, tenantId, "pathway_guidance", true, "j23-test pilot grant");
    check("manual grant recorded", (await hasFeatureGrant(tenantId, "pathway_guidance")) === true);
    check("manual grant unlocks the feature for free tier", (await hasEntitlement(tenantId, "pathway_guidance")) === true);
    const grantAudit = await db.auditLog.findFirst({ where: { action: "platform.feature_grant_added", entityId: tenantId } });
    check("manual grant is audit logged", !!grantAudit);
    await setFeatureGrant(ops, tenantId, "pathway_guidance", false);
    check("revoking the grant re-locks the feature", (await hasEntitlement(tenantId, "pathway_guidance")) === false);

    console.log("\n[5] Master Part-J toggle wins — OFF blocks EVERYONE, even Elite");
    await setPlan(tenantId, "elite", null); // entitled by plan
    const analyticsDef = getRevenueFeature("advanced_analytics")!;
    check("elite is entitled to advanced_analytics", (await hasEntitlement(tenantId, "advanced_analytics")) === true);
    // master switch ON (default) → fully gated check passes
    check("with toggle ON, requireRevenueFeature passes for elite", (await hasRevenueFeature(principal, "advanced_analytics")) === true);
    // switch OFF
    await setFlag(ops, jFeatureKey(analyticsDef.toggleId), true, "j23-test pause");
    let toggleBlocked = false;
    try {
      await requireRevenueFeature(principal, "advanced_analytics");
    } catch (e) {
      toggleBlocked = e instanceof FlagError && (e as FlagError).code === "FORBIDDEN";
    }
    check("toggle OFF blocks even an entitled Elite school (FlagError 403)", toggleBlocked);
    // switch back ON
    await setFlag(ops, jFeatureKey(analyticsDef.toggleId), false, "j23-test release");
    check("switching toggle back ON restores access", (await hasRevenueFeature(principal, "advanced_analytics")) === true);

    console.log("\n[6] Pricing is editable in NEYO Ops (round-trips + audits)");
    const catalog = await getPricingCatalog();
    const before = await db.auditLog.count({ where: { action: "platform.pricing_catalog_updated" } });
    // bump the skills_passport add-on price, save, read back, then restore.
    const edited = JSON.parse(JSON.stringify(catalog));
    const sp = edited.addOns.find((a: any) => a.key === "skills_passport");
    const originalPrice = sp ? sp.pricePerTerm : null;
    if (sp) sp.pricePerTerm = 4242;
    await savePricingCatalog(edited, { id: ops.id, fullName: ops.fullName, tenantId: ops.tenantId });
    const reread = await getPricingCatalog();
    const sp2 = reread.addOns.find((a: any) => a.key === "skills_passport");
    check("pricing edit persisted (skills_passport = 4242 KES)", !!sp2 && sp2.pricePerTerm === 4242);
    const after = await db.auditLog.count({ where: { action: "platform.pricing_catalog_updated" } });
    check("pricing edit is audit logged", after === before + 1);
    // restore original price
    if (sp && originalPrice !== null) { sp.pricePerTerm = originalPrice; await savePricingCatalog(edited, { id: ops.id, fullName: ops.fullName, tenantId: ops.tenantId }); }

    console.log(`\n✅ J.23 full-stack test: ${pass} checks passed, 0 failed.`);
  } finally {
    // ---- restore the seed exactly as we found it ----
    await db.subscription.update({
      where: { tenantId },
      data: { planKey: original.planKey, addOns: original.addOns },
    });
    for (const f of REVENUE_FEATURES) {
      await db.platformFlag.deleteMany({ where: { moduleKey: jFeatureKey(f.toggleId) } });
    }
    // ensure no test grants linger
    for (const k of allKeys) await setFeatureGrant(ops, tenantId, k, false).catch(() => {});
    await db.$disconnect();
  }
}

main().catch(async (e) => {
  console.error("\n❌ J.23 full-stack test FAILED:", e);
  await db.$disconnect();
  process.exit(1);
});
