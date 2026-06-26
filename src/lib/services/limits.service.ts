/**
 * Usage limits & overage (Feature A.5 — soft limits, SMS pre-send quota check).
 * Limits are SOFT: usage may exceed the plan limit up to limit*overageAllowance.
 * Beyond that, actions are blocked with an upgrade/top-up prompt.
 */
import { db } from "@/lib/db";
import { DEFAULT_PLAN_KEY, type PlanLimits } from "@/lib/core/plans";
import { getPlanFromCatalog, getPricingCatalog } from "@/lib/services/pricing-catalog.service";
import { ensureSubscription } from "@/lib/services/billing.service";

/** Current billing period key, e.g. "2026-T2" (rough term mapping). */
export function currentPeriodKey(now = new Date()): string {
  const m = now.getMonth(); // 0-11
  const term = m < 4 ? 1 : m < 8 ? 2 : 3;
  return `${now.getFullYear()}-T${term}`;
}

export interface LimitStatus {
  metric: keyof PlanLimits;
  used: number;
  limit: number;
  hardCap: number; // limit * overageAllowance
  remaining: number;
  overLimit: boolean; // past soft limit (warn)
  blocked: boolean; // past hard cap (stop)
}

async function getLimits(tenantId: string) {
  const sub = await ensureSubscription(tenantId);
  const plan = (await getPlanFromCatalog(sub.planKey)) ?? (await getPlanFromCatalog(DEFAULT_PLAN_KEY));
  if (!plan) throw new Error("NEYO pricing catalog is missing the default plan.");

  // Founder rule: SMS is outside packages. If a school has bought SMS add-ons,
  // the quota comes from active subscription add-on keys, not from the base plan.
  let smsTopUpLimit = 0;
  try {
    const activeAddOnKeys = JSON.parse(sub.addOns || "[]") as string[];
    if (Array.isArray(activeAddOnKeys) && activeAddOnKeys.length) {
      const catalog = await getPricingCatalog();
      for (const key of activeAddOnKeys) {
        const addOn = catalog.addOns.find((item) => item.key === key);
        const text = `${addOn?.key ?? key} ${addOn?.name ?? ""} ${addOn?.description ?? ""}`;
        if (/sms/i.test(text)) {
          const bundleCount = Number(text.match(/(\d[\d,]*)/)?.[1]?.replace(/,/g, "") || 0);
          smsTopUpLimit += bundleCount;
        }
      }
    }
  } catch {
    smsTopUpLimit = 0;
  }

  return { plan: { ...plan, limits: { ...plan.limits, smsPerTerm: smsTopUpLimit } }, sub };
}

/** Read current usage for a metric this period. */
export async function getUsage(
  tenantId: string,
  metric: keyof PlanLimits
): Promise<number> {
  const row = await db.usageCounter.findUnique({
    where: {
      tenantId_metric_periodKey: {
        tenantId,
        metric,
        periodKey: currentPeriodKey(),
      },
    },
  });
  return row?.used ?? 0;
}

/** Compute limit status for a metric (optionally simulating +delta usage). */
export async function checkLimit(
  tenantId: string,
  metric: keyof PlanLimits,
  delta = 0
): Promise<LimitStatus> {
  const { plan } = await getLimits(tenantId);
  const used = (await getUsage(tenantId, metric)) + delta;
  const limit = plan.limits[metric];
  const hardCap = Math.floor(limit * plan.overageAllowance);
  return {
    metric,
    used,
    limit,
    hardCap,
    remaining: Math.max(0, hardCap - used),
    overLimit: used > limit,
    blocked: used > hardCap,
  };
}

/**
 * SMS pre-send quota check (A.5). Call BEFORE sending `count` messages.
 * Returns whether it's allowed and a message for the top-up prompt.
 */
export async function checkSmsQuota(
  tenantId: string,
  count: number
): Promise<{ allowed: boolean; status: LimitStatus; message?: string }> {
  const status = await checkLimit(tenantId, "smsPerTerm", count);
  if (status.blocked) {
    return {
      allowed: false,
      status,
      message: `This would exceed your SMS quota (${status.limit}/term). Upgrade or top up to send more.`,
    };
  }
  if (status.overLimit) {
    return {
      allowed: true,
      status,
      message: `You're over your SMS limit; overage applies. ${status.remaining} left before sending is blocked.`,
    };
  }
  return { allowed: true, status };
}

/** Record usage after a successful action (idempotent per period row). */
export async function recordUsage(
  tenantId: string,
  metric: keyof PlanLimits,
  amount = 1
): Promise<void> {
  const periodKey = currentPeriodKey();
  await db.usageCounter.upsert({
    where: { tenantId_metric_periodKey: { tenantId, metric, periodKey } },
    update: { used: { increment: amount } },
    create: { tenantId, metric, periodKey, used: amount },
  });
}

/** Snapshot of all limit statuses for the billing page. */
export async function getAllLimitStatuses(
  tenantId: string
): Promise<LimitStatus[]> {
  const metrics: (keyof PlanLimits)[] = ["students", "staff", "smsPerTerm"];
  return Promise.all(metrics.map((m) => checkLimit(tenantId, m)));
}
