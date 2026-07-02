/**
 * PART M — Revenue, Data & Comms (repaired to true full-stack 2026-07-01).
 *
 * M.1 — NEYO Referral Engine: centrally-configured referral rules (NEYO Ops),
 * automatic detection of a referred school's FIRST REAL PAID NEYO subscription
 * payment, automatic crediting of BOTH schools via a real ledger
 * (ReferralCredit), and automatic application of that credit onto the next
 * real NEYO subscription charge — never onto a school's own students' fee
 * invoices (that is a different business, B.7).
 *
 * M.2 — SMS Margin Revenue: centrally-configured buy/sell price per SMS
 * (NEYO Ops), real margin ledger per send, and a company-wide revenue
 * dashboard read.
 */
import { db } from "@/lib/db";
import crypto from "crypto";
import {
  REFERRAL_SETTING_KEY,
  SMS_MARGIN_SETTING_KEY,
  referralRulesSchema,
  smsMarginConfigSchema,
  defaultReferralRules,
  defaultSmsMarginConfig,
  type ReferralRules,
  type SmsMarginConfig,
} from "@/lib/validations/revenue-ops";

export class RevenueOpsError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "FORBIDDEN" | "DUPLICATE", message: string) {
    super(message);
    this.name = "RevenueOpsError";
  }
}

// ---------------------------------------------------------------------------
// NEYO Ops configuration (company-level PlatformSetting — same pattern as the
// pricing catalog in pricing-catalog.service.ts).
// ---------------------------------------------------------------------------

export async function getReferralRules(): Promise<ReferralRules> {
  const setting = await db.platformSetting.findUnique({ where: { key: REFERRAL_SETTING_KEY } });
  if (!setting?.value) return defaultReferralRules();
  try {
    return referralRulesSchema.parse(JSON.parse(setting.value));
  } catch {
    return defaultReferralRules();
  }
}

export async function saveReferralRules(input: unknown, actor: { id: string; fullName: string; tenantId: string }) {
  const rules = referralRulesSchema.parse(input);
  const setting = await db.platformSetting.upsert({
    where: { key: REFERRAL_SETTING_KEY },
    create: { key: REFERRAL_SETTING_KEY, value: JSON.stringify(rules), updatedBy: actor.fullName },
    update: { value: JSON.stringify(rules), updatedBy: actor.fullName },
  });
  await db.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "platform.referral_rules_updated",
      entityType: "PlatformSetting",
      entityId: setting.key,
      metadata: JSON.stringify(rules),
    },
  });
  return rules;
}

export async function getSmsMarginConfig(): Promise<SmsMarginConfig> {
  const setting = await db.platformSetting.findUnique({ where: { key: SMS_MARGIN_SETTING_KEY } });
  if (!setting?.value) return defaultSmsMarginConfig();
  try {
    return smsMarginConfigSchema.parse(JSON.parse(setting.value));
  } catch {
    return defaultSmsMarginConfig();
  }
}

export async function saveSmsMarginConfig(input: unknown, actor: { id: string; fullName: string; tenantId: string }) {
  const config = smsMarginConfigSchema.parse(input);
  const setting = await db.platformSetting.upsert({
    where: { key: SMS_MARGIN_SETTING_KEY },
    create: { key: SMS_MARGIN_SETTING_KEY, value: JSON.stringify(config), updatedBy: actor.fullName },
    update: { value: JSON.stringify(config), updatedBy: actor.fullName },
  });
  await db.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "platform.sms_margin_config_updated",
      entityType: "PlatformSetting",
      entityId: setting.key,
      metadata: JSON.stringify(config),
    },
  });
  return config;
}

// ---------------------------------------------------------------------------
// M.1 — Referral engine
// ---------------------------------------------------------------------------

/** Generates (or returns the existing) referral code for a school. */
export async function ensureReferralCode(tenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new RevenueOpsError("NOT_FOUND", "School not found.");
  if (tenant.referralCode) return tenant.referralCode;

  // Generate and retry on the (astronomically unlikely) unique-collision case.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = "NEYO-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    try {
      await db.tenant.update({ where: { id: tenantId }, data: { referralCode: code } });
      return code;
    } catch {
      // unique collision — try again
    }
  }
  throw new RevenueOpsError("INVALID", "Could not generate a unique referral code. Try again.");
}

/** A school applies a referral code they were given (during onboarding). */
export async function applyReferralCode(newTenantId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const referrer = await db.tenant.findUnique({ where: { referralCode: code } });
  if (!referrer) throw new RevenueOpsError("NOT_FOUND", "That referral code was not found.");
  if (referrer.id === newTenantId) throw new RevenueOpsError("INVALID", "A school cannot refer itself.");

  const newTenant = await db.tenant.findUnique({ where: { id: newTenantId } });
  if (!newTenant) throw new RevenueOpsError("NOT_FOUND", "School not found.");
  if (newTenant.referredByTenantId) throw new RevenueOpsError("DUPLICATE", "A referral code has already been applied to this school.");

  await db.tenant.update({ where: { id: newTenantId }, data: { referredByTenantId: referrer.id } });
  return { referrerId: referrer.id, referrerName: referrer.name };
}

/**
 * Fires automatically the moment a school's NEYO SUBSCRIPTION payment (NOT a
 * parent's school-fee payment) is marked PAID. Idempotent per payment — safe
 * to call more than once for the same payment id.
 *
 * Rules are centrally controlled by NEYO Ops (getReferralRules()):
 *  - must be enabled
 *  - the referred school must have a `referredByTenantId` AND not have
 *    already claimed its referral (`hasClaimedReferral`)
 *  - this must be at least the (minimumPaidTermsBeforeReward + 1)-th PAID
 *    subscription payment for the referred school (defaults to the FIRST)
 */
export async function processReferralRewardsForPayment(paymentId: string) {
  const payment = await db.subscriptionPayment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PAID") return { credited: false as const, reason: "PAYMENT_NOT_PAID" as const };

  // Idempotency: never credit twice for the same triggering payment.
  const already = await db.referralCredit.findUnique({ where: { triggerPaymentId: paymentId } });
  if (already) return { credited: false as const, reason: "ALREADY_PROCESSED" as const };

  const rules = await getReferralRules();
  if (!rules.enabled) return { credited: false as const, reason: "REFERRALS_DISABLED" as const };

  const tenant = await db.tenant.findUnique({ where: { id: payment.tenantId } });
  if (!tenant || !tenant.referredByTenantId || tenant.hasClaimedReferral) {
    return { credited: false as const, reason: "NOT_A_QUALIFYING_REFERRAL" as const };
  }

  if (rules.minimumPaidTermsBeforeReward > 0) {
    const paidCount = await db.subscriptionPayment.count({ where: { tenantId: tenant.id, status: "PAID" } });
    if (paidCount < rules.minimumPaidTermsBeforeReward + 1) {
      return { credited: false as const, reason: "MINIMUM_TERMS_NOT_MET" as const };
    }
  }

  const referrer = await db.tenant.findUnique({ where: { id: tenant.referredByTenantId } });
  if (!referrer) return { credited: false as const, reason: "REFERRER_NOT_FOUND" as const };

  // Mark claimed FIRST so a race/duplicate call can never double-credit.
  await db.tenant.update({ where: { id: tenant.id }, data: { hasClaimedReferral: true } });

  const creditsCreated: string[] = [];

  const referredCredit = await db.referralCredit.create({
    data: {
      tenantId: tenant.id,
      role: "REFERRED",
      counterpartTenantId: referrer.id,
      counterpartName: referrer.name,
      discountPct: rules.discountPct,
      triggerPaymentId: paymentId,
      status: "PENDING",
    },
  });
  creditsCreated.push(referredCredit.id);

  await db.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorId: "SYSTEM",
      actorName: "NEYO Billing",
      action: "billing.referral_credit_earned",
      entityType: "ReferralCredit",
      entityId: referredCredit.id,
      metadata: JSON.stringify({ role: "REFERRED", counterpart: referrer.name, discountPct: rules.discountPct, triggerPaymentId: paymentId }),
    },
  });

  if (rules.rewardBothSides) {
    const referrerCredit = await db.referralCredit.create({
      data: {
        tenantId: referrer.id,
        role: "REFERRER",
        counterpartTenantId: tenant.id,
        counterpartName: tenant.name,
        discountPct: rules.discountPct,
        // A referrer credit is keyed to the SAME triggering payment so it stays
        // uniquely tied to this one referral conversion event.
        triggerPaymentId: `${paymentId}:referrer`,
        status: "PENDING",
      },
    });
    creditsCreated.push(referrerCredit.id);

    await db.auditLog.create({
      data: {
        tenantId: referrer.id,
        actorId: "SYSTEM",
        actorName: "NEYO Billing",
        action: "billing.referral_credit_earned",
        entityType: "ReferralCredit",
        entityId: referrerCredit.id,
        metadata: JSON.stringify({ role: "REFERRER", counterpart: tenant.name, discountPct: rules.discountPct, triggerPaymentId: paymentId }),
      },
    });
  }

  return { credited: true as const, creditIds: creditsCreated };
}

/**
 * Applies a PENDING referral credit onto a school's NEXT real NEYO
 * subscription charge. Called from the billing seam right before it charges
 * `chargeViaSeam` for a subscribe/renew, so the discount reduces the real
 * amount billed via M-Pesa STK, not a fake number nobody sees.
 */
export async function pendingReferralDiscountKes(tenantId: string, baseAmountKes: number) {
  const pending = await db.referralCredit.findMany({
    where: { tenantId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  if (pending.length === 0) return { discountKes: 0, creditIds: [] as string[] };

  // Discounts stack additively but never exceed the invoice itself.
  let remaining = baseAmountKes;
  let totalDiscount = 0;
  const applied: string[] = [];
  for (const credit of pending) {
    if (remaining <= 0) break;
    const thisDiscount = Math.min(Math.round(baseAmountKes * credit.discountPct), remaining);
    totalDiscount += thisDiscount;
    remaining -= thisDiscount;
    applied.push(credit.id);
  }
  return { discountKes: totalDiscount, creditIds: applied };
}

/** Marks referral credits APPLIED once the discounted payment they informed is confirmed PAID. */
export async function markReferralCreditsApplied(creditIds: string[], paymentId: string, amountEachKes: number) {
  if (creditIds.length === 0) return;
  await db.referralCredit.updateMany({
    where: { id: { in: creditIds }, status: "PENDING" },
    data: { status: "APPLIED", appliedToPaymentId: paymentId, appliedAmountKes: amountEachKes, appliedAt: new Date() },
  });
}

/** NEYO Ops: manually expire a stale/erroneous pending credit (audited). */
export async function expireReferralCredit(creditId: string, actor: { id: string; fullName: string }) {
  const credit = await db.referralCredit.findUnique({ where: { id: creditId } });
  if (!credit) throw new RevenueOpsError("NOT_FOUND", "Referral credit not found.");
  if (credit.status !== "PENDING") throw new RevenueOpsError("INVALID", "Only a pending credit can be expired.");
  const updated = await db.referralCredit.update({ where: { id: creditId }, data: { status: "EXPIRED" } });
  await db.auditLog.create({
    data: {
      tenantId: credit.tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "platform.referral_credit_expired",
      entityType: "ReferralCredit",
      entityId: creditId,
      metadata: JSON.stringify({ discountPct: credit.discountPct, counterpart: credit.counterpartName }),
    },
  });
  return updated;
}

/** Company-wide referral dashboard for NEYO Ops. */
export async function referralDashboard() {
  const [totalReferred, totalCreditsIssued, pending, applied, expired, recentCredits] = await Promise.all([
    db.tenant.count({ where: { referredByTenantId: { not: null } } }),
    db.referralCredit.count(),
    db.referralCredit.count({ where: { status: "PENDING" } }),
    db.referralCredit.count({ where: { status: "APPLIED" } }),
    db.referralCredit.count({ where: { status: "EXPIRED" } }),
    db.referralCredit.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);

  const tenantIds = [...new Set(recentCredits.map((c) => c.tenantId))];
  const tenants = tenantIds.length
    ? await db.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true, slug: true } })
    : [];
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));

  return {
    totalReferredSchools: totalReferred,
    totalCreditsIssued,
    pending,
    applied,
    expired,
    recentCredits: recentCredits.map((c) => ({
      id: c.id,
      schoolName: tenantMap.get(c.tenantId)?.name ?? "Unknown",
      schoolSlug: tenantMap.get(c.tenantId)?.slug ?? null,
      role: c.role,
      counterpartName: c.counterpartName,
      discountPct: c.discountPct,
      status: c.status,
      appliedAmountKes: c.appliedAmountKes,
      appliedAt: c.appliedAt,
      createdAt: c.createdAt,
    })),
  };
}

/** A school's own referral status view (Settings → Billing). */
export async function schoolReferralStatus(tenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new RevenueOpsError("NOT_FOUND", "School not found.");

  const [credits, referredCount] = await Promise.all([
    db.referralCredit.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
    db.tenant.count({ where: { referredByTenantId: tenantId } }),
  ]);

  const rules = await getReferralRules();

  return {
    referralCode: tenant.referralCode,
    hasClaimedReferral: tenant.hasClaimedReferral,
    referredByTenantId: tenant.referredByTenantId,
    schoolsReferred: referredCount,
    rulesActive: rules.enabled,
    discountPct: rules.discountPct,
    credits: credits.map((c) => ({
      id: c.id,
      role: c.role,
      counterpartName: c.counterpartName,
      discountPct: c.discountPct,
      status: c.status,
      appliedAmountKes: c.appliedAmountKes,
      appliedAt: c.appliedAt,
      createdAt: c.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// M.2 — SMS margin revenue
// ---------------------------------------------------------------------------

/** Company-wide SMS margin dashboard for NEYO Ops. */
export async function smsMarginDashboard() {
  const [config, totals, byStatus, byTenant] = await Promise.all([
    getSmsMarginConfig(),
    db.smsMarginLedger.aggregate({
      _sum: { messageCount: true, marginKes: true },
    }),
    db.smsMarginLedger.groupBy({
      by: ["status"],
      _sum: { messageCount: true, marginKes: true },
    }),
    db.smsMarginLedger.groupBy({
      by: ["tenantId"],
      _sum: { messageCount: true, marginKes: true },
      orderBy: { _sum: { marginKes: "desc" } },
      take: 10,
    }),
  ]);

  const tenantIds = byTenant.map((row) => row.tenantId);
  const tenants = tenantIds.length
    ? await db.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } })
    : [];
  const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

  return {
    config,
    totalMessages: totals._sum.messageCount ?? 0,
    totalMarginKes: Math.round((totals._sum.marginKes ?? 0) * 100) / 100,
    byStatus: byStatus.map((row) => ({
      status: row.status,
      messageCount: row._sum.messageCount ?? 0,
      marginKes: Math.round((row._sum.marginKes ?? 0) * 100) / 100,
    })),
    topSchools: byTenant.map((row) => ({
      tenantId: row.tenantId,
      schoolName: tenantMap.get(row.tenantId) ?? "Unknown",
      messageCount: row._sum.messageCount ?? 0,
      marginKes: Math.round((row._sum.marginKes ?? 0) * 100) / 100,
    })),
  };
}

/** NEYO Ops: mark a school's UNBILLED SMS margin rows as INVOICED (once billed for the period). */
export async function markSmsLedgerInvoiced(tenantId: string, actor: { id: string; fullName: string }) {
  const result = await db.smsMarginLedger.updateMany({
    where: { tenantId, status: "UNBILLED" },
    data: { status: "INVOICED" },
  });
  await db.auditLog.create({
    data: {
      tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "platform.sms_ledger_marked_invoiced",
      entityType: "SmsMarginLedger",
      entityId: tenantId,
      metadata: JSON.stringify({ rowsUpdated: result.count }),
    },
  });
  return result.count;
}

/**
 * M.1 — In-app prompt encouraging a school to refer another school, sent
 * immediately after a REAL successful NEYO subscription payment. Best-effort:
 * never blocks a real payment activation if it fails. Only fires when
 * referrals are enabled centrally and never spams — at most once per
 * subscription period (keyed off the paying tenant + a daily-safe check).
 */
export async function promptReferralAfterPayment(tenantId: string) {
  const rules = await getReferralRules();
  if (!rules.enabled) return;

  const [tenant, recentPrompt] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId } }),
    db.notification.findFirst({
      where: { tenantId, category: "referral_prompt" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!tenant) return;

  // Never nag more than once every 30 days for the same school.
  if (recentPrompt && Date.now() - new Date(recentPrompt.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000) {
    return;
  }

  const code = await ensureReferralCode(tenantId);
  const leaders = await db.user.findMany({
    where: { tenantId, role: { in: ["SCHOOL_OWNER", "PRINCIPAL"] }, isActive: true },
    select: { id: true },
  });

  for (const leader of leaders) {
    await db.notification.create({
      data: {
        tenantId,
        recipientId: leader.id,
        title: "Know another school? You could both save.",
        body: `Share your code ${code} with another school. Once they become a paying NEYO customer, you both get ${Math.round(rules.discountPct * 100)}% off your next subscription payment.`,
        category: "referral_prompt",
        href: "/settings/billing",
        channels: JSON.stringify({ in_app: "sent" }),
      },
    });
  }
}
