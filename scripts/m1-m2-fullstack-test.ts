import assert from "node:assert/strict";
import { db } from "@/lib/db";
import {
  ensureReferralCode,
  applyReferralCode,
  processReferralRewardsForPayment,
  pendingReferralDiscountKes,
  markReferralCreditsApplied,
  expireReferralCredit,
  referralDashboard,
  schoolReferralStatus,
  getReferralRules,
  saveReferralRules,
  getSmsMarginConfig,
  saveSmsMarginConfig,
  smsMarginDashboard,
  markSmsLedgerInvoiced,
  promptReferralAfterPayment,
} from "@/lib/services/revenue-ops.service";
import { sendSms } from "@/lib/notifications/sms";

/**
 * PART M — Referral Engine (M.1) + SMS Margin Revenue (M.2), repaired to true
 * full-stack 2026-07-01. This test proves the REAL behavior end-to-end:
 *  - a referral code is generated, applied, and a referral relationship formed
 *  - a referral reward is NOT granted for a non-existent/failed payment
 *  - a referral reward IS granted the moment a REAL PAID subscription payment
 *    exists, crediting BOTH schools (referrer + referred) per the centrally
 *    configured rules — never touching a school's own fee invoices
 *  - the credit is idempotent (never double-issued for the same payment)
 *  - the pending credit genuinely reduces the amount of the NEXT real
 *    subscription charge, and is marked APPLIED once that charge is paid
 *  - NEYO Ops can centrally configure the discount % and the SMS buy/sell
 *    price, and both dashboards reflect real data, not simulated numbers
 *  - every real SMS send (via the shared sendSms() transport) creates a real
 *    SmsMarginLedger row using the LIVE configured prices (not hardcoded)
 */
async function main() {
  const NEYO_ADMIN = { id: "SYSTEM_TEST_ADMIN", fullName: "Test Admin" };

  // --- Set up two throwaway schools for this test -------------------------
  const referrerTenant = await db.tenant.create({
    data: { name: "Test Referrer School", slug: `test-referrer-${Date.now()}` },
  });
  const referredTenant = await db.tenant.create({
    data: { name: "Test Referred School", slug: `test-referred-${Date.now()}` },
  });

  try {
    // 1) Referral rules: force a known, deterministic config for this test.
    await saveReferralRules(
      { enabled: true, discountPct: 0.05, rewardBothSides: true, minimumPaidTermsBeforeReward: 0, notes: "test" },
      { id: NEYO_ADMIN.id, fullName: NEYO_ADMIN.fullName, tenantId: referrerTenant.id }
    );
    const rules = await getReferralRules();
    assert.equal(rules.enabled, true, "referral rules must save and reload as enabled");
    assert.equal(rules.discountPct, 0.05, "referral discount % must save and reload correctly");

    // 2) Generate + apply a referral code.
    const code = await ensureReferralCode(referrerTenant.id);
    assert.ok(code.startsWith("NEYO-"), "referral code must have the NEYO- prefix");
    const sameCodeAgain = await ensureReferralCode(referrerTenant.id);
    assert.equal(code, sameCodeAgain, "ensureReferralCode must be idempotent per school");

    await assert.rejects(
      () => applyReferralCode(referrerTenant.id, code),
      /cannot refer itself/i,
      "a school must not be able to refer itself"
    );

    const applied = await applyReferralCode(referredTenant.id, code);
    assert.equal(applied.referrerId, referrerTenant.id, "applying a code must link the referred school to the correct referrer");

    await assert.rejects(
      () => applyReferralCode(referredTenant.id, code),
      /already been applied/i,
      "a school must not be able to apply a referral code twice"
    );

    // 3) A subscription with a PENDING (not yet PAID) payment must NOT reward.
    const sub = await db.subscription.create({
      data: { tenantId: referredTenant.id, planKey: "pro", status: "ACTIVE", grandfatheredPrice: 9000, currentPeriodEnd: new Date() },
    });
    const pendingPayment = await db.subscriptionPayment.create({
      data: { subscriptionId: sub.id, tenantId: referredTenant.id, amount: 9000, status: "PENDING", periodStart: new Date(), periodEnd: new Date() },
    });
    const noRewardYet = await processReferralRewardsForPayment(pendingPayment.id);
    assert.equal(noRewardYet.credited, false, "a PENDING (unpaid) subscription payment must never trigger a referral reward");

    // 4) A REAL PAID subscription payment DOES trigger the reward, crediting BOTH schools.
    const paidPayment = await db.subscriptionPayment.update({ where: { id: pendingPayment.id }, data: { status: "PAID", paidAt: new Date(), mpesaRef: `TEST-${Date.now()}` } });
    const rewardResult = await processReferralRewardsForPayment(paidPayment.id);
    assert.equal(rewardResult.credited, true, "a PAID subscription payment for a referred school must trigger a real referral reward");
    assert.equal((rewardResult as any).creditIds.length, 2, "rewardBothSides=true must create exactly 2 credits (referred + referrer)");

    const referredCredit = await db.referralCredit.findFirst({ where: { tenantId: referredTenant.id, role: "REFERRED" } });
    const referrerCredit = await db.referralCredit.findFirst({ where: { tenantId: referrerTenant.id, role: "REFERRER" } });
    assert.ok(referredCredit, "the referred school must have a real REFERRED credit row");
    assert.ok(referrerCredit, "the referrer school must have a real REFERRER credit row");
    assert.equal(referredCredit!.status, "PENDING", "a freshly earned credit must start PENDING, not silently already-applied");
    assert.equal(referredCredit!.discountPct, 0.05, "the credit must use the centrally-configured discount %, not a hardcoded number");

    // 5) Idempotency: processing the SAME payment again must NOT double-credit.
    const secondAttempt = await processReferralRewardsForPayment(paidPayment.id);
    assert.equal(secondAttempt.credited, false, "processing the same payment twice must never double-issue a credit");
    const creditCountAfter = await db.referralCredit.count({ where: { tenantId: { in: [referredTenant.id, referrerTenant.id] } } });
    assert.equal(creditCountAfter, 2, "there must be exactly 2 credits total, never duplicated");

    const updatedTenant = await db.tenant.findUnique({ where: { id: referredTenant.id } });
    assert.equal(updatedTenant!.hasClaimedReferral, true, "the referred school must be marked as having claimed its referral");

    // 6) A PENDING credit must genuinely reduce the amount of the NEXT real charge.
    const { discountKes, creditIds } = await pendingReferralDiscountKes(referredTenant.id, 9000);
    assert.equal(discountKes, 450, "a 5% discount on a KES 9,000 charge must be KES 450, computed from the real rule, not hardcoded");
    assert.equal(creditIds.length, 1, "exactly the one pending credit for this school must be selected");

    await markReferralCreditsApplied(creditIds, "next-payment-id", discountKes);
    const nowApplied = await db.referralCredit.findUnique({ where: { id: creditIds[0] } });
    assert.equal(nowApplied!.status, "APPLIED", "marking a credit applied must really flip its status");
    assert.equal(nowApplied!.appliedAmountKes, 450, "the applied KES amount must be recorded exactly");

    // 7) NEYO Ops can manually expire a still-pending credit (the referrer's).
    const expired = await expireReferralCredit(referrerCredit!.id, NEYO_ADMIN);
    assert.equal(expired.status, "EXPIRED", "expiring a credit must really flip its status to EXPIRED");
    await assert.rejects(() => expireReferralCredit(referrerCredit!.id, NEYO_ADMIN), /only a pending credit/i, "an already-expired credit cannot be expired again");

    // 8) Dashboards must reflect REAL data.
    const dash = await referralDashboard();
    assert.ok(dash.totalReferredSchools >= 1, "referral dashboard must count at least our one referred school");
    assert.ok(dash.applied >= 1, "referral dashboard must show at least one applied credit");
    assert.ok(dash.expired >= 1, "referral dashboard must show at least one expired credit");

    const schoolStatus = await schoolReferralStatus(referredTenant.id);
    assert.equal(schoolStatus.referredByTenantId, referrerTenant.id, "a school's own referral status must show who referred them");
    assert.ok(schoolStatus.credits.length >= 1, "a school's own referral status must list its real credits");

    // 8b) In-app referral prompt fires to real leadership users after a real payment, and is throttled.
    const owner = await db.user.create({
      data: {
        tenantId: referrerTenant.id,
        neyoLoginId: `TEST-${Date.now()}`,
        fullName: "Test Owner",
        role: "SCHOOL_OWNER",
        isActive: true,
      },
    });
    await promptReferralAfterPayment(referrerTenant.id);
    const promptsAfterFirst = await db.notification.count({ where: { tenantId: referrerTenant.id, category: "referral_prompt" } });
    assert.equal(promptsAfterFirst, 1, "a real in-app referral prompt must be created for the school's real owner after a payment");
    const promptRow = await db.notification.findFirst({ where: { tenantId: referrerTenant.id, category: "referral_prompt" } });
    assert.equal(promptRow!.recipientId, owner.id, "the referral prompt must be addressed to a real leadership user");
    assert.ok(promptRow!.body.includes(code), "the referral prompt must include the school's real referral code, not a placeholder");

    await promptReferralAfterPayment(referrerTenant.id);
    const promptsAfterSecond = await db.notification.count({ where: { tenantId: referrerTenant.id, category: "referral_prompt" } });
    assert.equal(promptsAfterSecond, 1, "the referral prompt must be throttled — calling it again immediately must not spam a second notification");

    // ---------------------------------------------------------------------
    // M.2 — SMS Margin Revenue
    // ---------------------------------------------------------------------
    await saveSmsMarginConfig({ costPerSmsKes: 0.7, pricePerSmsKes: 1.1, billingWindow: "TERMLY" }, { id: NEYO_ADMIN.id, fullName: NEYO_ADMIN.fullName, tenantId: referrerTenant.id });
    const smsConfig = await getSmsMarginConfig();
    assert.equal(smsConfig.costPerSmsKes, 0.7, "SMS cost price must save and reload from NEYO Ops config, not a hardcoded constant");
    assert.equal(smsConfig.pricePerSmsKes, 1.1, "SMS sell price must save and reload from NEYO Ops config, not a hardcoded constant");

    await assert.rejects(
      () => saveSmsMarginConfig({ costPerSmsKes: 2, pricePerSmsKes: 1, billingWindow: "TERMLY" }, { id: NEYO_ADMIN.id, fullName: NEYO_ADMIN.fullName, tenantId: referrerTenant.id }),
      "NEYO Ops must be blocked from configuring a sell price below cost (selling at a loss)"
    );

    const beforeCount = await db.smsMarginLedger.count({ where: { tenantId: referredTenant.id } });
    const smsResult = await sendSms("+254700000000", "Full-stack M.2 test message", { tenantId: referredTenant.id, prefix: false });
    assert.equal(smsResult.provider, "dev-console", "no live Africa's Talking creds are configured in this sandbox, so the dev-console fallback path must be used");
    const afterCount = await db.smsMarginLedger.count({ where: { tenantId: referredTenant.id } });
    assert.equal(afterCount, beforeCount + 1, "every real SMS send must create exactly one margin ledger row");

    const latestLedgerRow = await db.smsMarginLedger.findFirst({ where: { tenantId: referredTenant.id }, orderBy: { createdAt: "desc" } });
    assert.equal(latestLedgerRow!.costPerSmsKes, 0.7, "the margin ledger row must use the LIVE configured cost price, not a hardcoded 0.8");
    assert.equal(latestLedgerRow!.pricePerSmsKes, 1.1, "the margin ledger row must use the LIVE configured sell price, not a hardcoded 1.2");
    assert.ok(Math.abs(latestLedgerRow!.marginKes - 0.4) < 1e-9, "the margin must be computed as sell minus cost using the live configured prices");

    const smsDash = await smsMarginDashboard();
    assert.ok(smsDash.totalMessages >= 1, "SMS margin dashboard must show real total messages sent");
    assert.ok(smsDash.totalMarginKes > 0, "SMS margin dashboard must show real positive margin revenue");
    assert.ok(smsDash.topSchools.some((s) => s.tenantId === referredTenant.id), "SMS margin dashboard must list the school that actually sent the SMS");

    const invoicedCount = await markSmsLedgerInvoiced(referredTenant.id, NEYO_ADMIN);
    assert.ok(invoicedCount >= 1, "marking a school's SMS ledger invoiced must really update at least one row");
    const stillUnbilled = await db.smsMarginLedger.count({ where: { tenantId: referredTenant.id, status: "UNBILLED" } });
    assert.equal(stillUnbilled, 0, "after marking invoiced, no UNBILLED rows should remain for that school");

    console.log("✓ PART M (M.1 Referral Engine + M.2 SMS Margin Revenue) full-stack verification passed — real DB rows, real discount math, real idempotency, real dashboards, no hardcoded prices.");
  } finally {
    // Clean up every row this test created so re-running stays idempotent.
    await db.notification.deleteMany({ where: { tenantId: { in: [referrerTenant.id, referredTenant.id] } } });
    await db.user.deleteMany({ where: { tenantId: { in: [referrerTenant.id, referredTenant.id] } } });
    await db.smsMarginLedger.deleteMany({ where: { tenantId: { in: [referrerTenant.id, referredTenant.id] } } });
    await db.referralCredit.deleteMany({ where: { tenantId: { in: [referrerTenant.id, referredTenant.id] } } });
    await db.subscriptionPayment.deleteMany({ where: { tenantId: { in: [referrerTenant.id, referredTenant.id] } } });
    await db.subscription.deleteMany({ where: { tenantId: { in: [referrerTenant.id, referredTenant.id] } } });
    await db.tenant.deleteMany({ where: { id: { in: [referrerTenant.id, referredTenant.id] } } });
    await db.platformSetting.deleteMany({ where: { key: { in: ["neyo_referral_rules", "neyo_sms_margin_config"] } } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
