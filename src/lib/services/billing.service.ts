/**
 * Billing & subscription service (Feature A.5).
 * - Subscribe / change plan with PRICE GRANDFATHERING (price locked at signup).
 * - Subscription STATE MACHINE: ACTIVE -> PAST_DUE -> GRACE -> SUSPENDED.
 *   Data is PRESERVED throughout (we never delete on non-payment).
 * - Payment goes through a swappable seam (real Daraja STK lands in A.6).
 *   In dev the seam auto-confirms so the whole flow is testable.
 */
import { db } from "@/lib/db";
import { DEFAULT_PLAN_KEY } from "@/lib/core/plans";
import { getPlanFromCatalog } from "@/lib/services/pricing-catalog.service";

const TERM_DAYS = 120; // ~one school term
const GRACE_DAYS = 14; // grace period after a missed payment (A.5)

export class BillingError extends Error {
  constructor(
    public code: "UNKNOWN_PLAN" | "TOO_MANY_ADDONS" | "NO_SUBSCRIPTION",
    message: string
  ) {
    super(message);
    this.name = "BillingError";
  }
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

async function billingNoticeAlreadySent(subscriptionId: string, action: string) {
  const existing = await db.auditLog.findFirst({ where: { entityType: "Subscription", entityId: subscriptionId, action } });
  return Boolean(existing);
}

export async function sendBillingNotice(
  tenantId: string,
  subscriptionId: string,
  action: string,
  title: string,
  body: string,
  metadata: Record<string, unknown> = {}
) {
  const [{ createInApp }, { sendSms }] = await Promise.all([
    import("@/lib/services/notification.service"),
    import("@/lib/notifications/sms"),
  ]);
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true, phone: true } });
  const leaders = await db.user.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { role: { in: ["SCHOOL_OWNER", "PRINCIPAL"] } },
        { secondaryRole: { in: ["SCHOOL_OWNER", "PRINCIPAL"] } },
      ],
    },
    select: { id: true },
  });

  let inApp = 0;
  for (const leader of leaders) {
    await createInApp({ tenantId, recipientId: leader.id, title, body, category: "billing", href: "/settings/billing" });
    inApp++;
  }

  let sms = 0;
  if (tenant?.phone) {
    const sent = await sendSms(tenant.phone, `NEYO: ${title}. ${body}`);
    if (sent.ok) sms = 1;
  }

  await audit(tenantId, { id: "system", fullName: "System" }, action, { subscriptionId, tenantName: tenant?.name, inApp, sms, ...metadata }, subscriptionId);
  return { inApp, sms };
}

function daysUntil(date: Date, now: Date) {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

/** Ensure a tenant has a subscription row. Part V (2026-07-06, founder-
 * confirmed "migrate everyone now"): every NEW subscription row defaults to
 * the real SIZE_BASED_V2 pricing mode — the old LEGACY_TIER plan system is
 * fully retired for pricing purposes going forward. */
export async function ensureSubscription(tenantId: string) {
  const existing = await db.subscription.findUnique({ where: { tenantId } });
  if (existing) return existing;
  const plan = await getPlanFromCatalog(DEFAULT_PLAN_KEY);
  if (!plan) throw new BillingError("UNKNOWN_PLAN", "Default plan is not configured.");
  return db.subscription.create({
    data: {
      tenantId,
      planKey: plan.key,
      status: "ACTIVE",
      pricingMode: "SIZE_BASED_V2",
      grandfatheredPrice: plan.pricePerTerm,
      currentPeriodEnd: addDays(new Date(), TERM_DAYS),
    },
  });
}

/**
 * Subscribe/change to a plan. Creates a PENDING payment, "charges" via the
 * seam, and on success activates the plan with its price grandfathered.
 */
export async function subscribeToPlan(
  tenantId: string,
  actor: { id: string; fullName: string },
  planKey: string
) {
  const plan = await getPlanFromCatalog(planKey);
  if (!plan) throw new BillingError("UNKNOWN_PLAN", "That plan does not exist.");

  const sub = await ensureSubscription(tenantId);
  const now = new Date();
  const periodEnd = addDays(now, TERM_DAYS);

  // Free plan: activate immediately, no payment.
  if (plan.pricePerTerm === 0) {
    const updated = await db.subscription.update({
      where: { tenantId },
      data: {
        planKey: plan.key,
        status: "ACTIVE",
        grandfatheredPrice: 0,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        graceEndsAt: null,
      },
    });
    await audit(tenantId, actor, "billing.subscribed", { planKey, price: 0 });
    return { subscription: updated, payment: null };
  }

  // Paid plan: record a pending payment then run it through the seam.
  const payment = await db.subscriptionPayment.create({
    data: {
      subscriptionId: sub.id,
      tenantId,
      amount: plan.pricePerTerm,
      status: "PENDING",
      method: "mpesa_stk",
      periodStart: now,
      periodEnd,
    },
  });

  const result = await chargeViaSeam(payment.amount);

  if (!result.ok) {
    await db.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    await audit(tenantId, actor, "billing.payment_failed", { planKey });
    return { subscription: sub, payment: { ...payment, status: "FAILED" } };
  }

  const [updated, paid] = await db.$transaction([
    db.subscription.update({
      where: { tenantId },
      data: {
        planKey: plan.key,
        status: "ACTIVE",
        grandfatheredPrice: plan.pricePerTerm, // lock today's price (A.5)
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        graceEndsAt: null,
      },
    }),
    db.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt: new Date(), mpesaRef: result.ref },
    }),
  ]);

  await audit(tenantId, actor, "billing.subscribed", {
    planKey,
    price: plan.pricePerTerm,
    mpesaRef: result.ref,
  });
  return { subscription: updated, payment: paid };
}

/**
 * Subscription STATE MACHINE tick (A.5). Run by cron in prod.
 * - ACTIVE past its period end -> PAST_DUE (start grace).
 * - GRACE/PAST_DUE past graceEndsAt -> SUSPENDED (data preserved).
 * Returns how many subscriptions changed state.
 */
export async function runSubscriptionStateMachine(now = new Date()) {
  let changed = 0;

  // 1) ACTIVE but overdue -> GRACE window + immediate customer communication.
  const overdue = await db.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lt: now }, grandfatheredPrice: { gt: 0 } },
  });
  for (const s of overdue) {
    const graceEndsAt = addDays(now, GRACE_DAYS);
    await db.subscription.update({
      where: { id: s.id },
      data: { status: "GRACE", graceEndsAt },
    });
    await audit(s.tenantId, { id: "system", fullName: "System" }, "billing.entered_grace", { graceEndsAt, dataPreserved: true }, s.id);
    await sendBillingNotice(
      s.tenantId,
      s.id,
      "billing.grace_notice_sent",
      "Subscription grace period started",
      `Payment is overdue. Your school remains open during grace until ${graceEndsAt.toLocaleDateString("en-KE")}. Please pay to avoid suspension. Data is preserved.`,
      { graceEndsAt }
    );
    changed++;
  }

  // 2) Warning before expiry if communication has not already happened.
  const warningCutoff = addDays(now, 3);
  const graceEndingSoon = await db.subscription.findMany({
    where: { status: "GRACE", graceEndsAt: { gte: now, lte: warningCutoff } },
  });
  for (const s of graceEndingSoon) {
    if (!s.graceEndsAt) continue;
    const sent = await billingNoticeAlreadySent(s.id, "billing.grace_warning_sent");
    if (sent) continue;
    await sendBillingNotice(
      s.tenantId,
      s.id,
      "billing.grace_warning_sent",
      "Subscription grace ends soon",
      `Grace ends in ${daysUntil(s.graceEndsAt, now)} day(s). Please pay or contact NEYO before access is suspended. Data is preserved either way.`,
      { graceEndsAt: s.graceEndsAt }
    );
  }

  // 3) GRACE expired -> final notice + SUSPENDED (we DO NOT delete any data).
  const graceExpired = await db.subscription.findMany({
    where: { status: "GRACE", graceEndsAt: { lt: now } },
  });
  for (const s of graceExpired) {
    const hadWarning = await billingNoticeAlreadySent(s.id, "billing.grace_warning_sent");
    if (!hadWarning) {
      await sendBillingNotice(
        s.tenantId,
        s.id,
        "billing.suspension_notice_sent",
        "Subscription suspended after grace period",
        "Grace has ended without payment or recorded NEYO communication. Access is suspended per policy. School data is preserved and will reconnect after payment.",
        { graceEndsAt: s.graceEndsAt, dataPreserved: true }
      );
    }
    await db.subscription.update({
      where: { id: s.id },
      data: { status: "SUSPENDED" },
    });
    await audit(s.tenantId, { id: "system", fullName: "System" }, "billing.suspended", { graceEndsAt: s.graceEndsAt, dataPreserved: true, policy: "suspend_not_delete" }, s.id);
    changed++;
  }

  return changed;
}

/** Mark a subscription overdue for testing the state machine. */
async function audit(
  tenantId: string,
  actor: { id: string; fullName: string },
  action: string,
  metadata: Record<string, unknown>,
  entityId?: string
) {
  await db.auditLog.create({
    data: {
      tenantId,
      actorId: actor.id === "system" ? null : actor.id,
      actorName: actor.fullName,
      action,
      entityType: "Subscription",
      entityId,
      metadata: JSON.stringify(metadata),
    },
  });
}

/**
 * Payment seam (A.6 — M-Pesa STK via Daraja, built later).
 * DEV: auto-confirm with a fake ref so the billing flow is fully testable.
 * PROD: replace with a real Daraja STK push + callback confirmation.
 */
async function chargeViaSeam(
  amountKes: number
): Promise<{ ok: true; ref: string } | { ok: false }> {
  void amountKes;
  // --- Real Daraja STK push goes here in A.6 ---
  if (process.env.NODE_ENV === "production") {
    // Without real creds we cannot charge in prod; fail closed.
    return { ok: false };
  }
  return { ok: true, ref: `DEV-${Date.now().toString(36).toUpperCase()}` };
}
