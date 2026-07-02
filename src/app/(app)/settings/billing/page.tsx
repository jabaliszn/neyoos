import { requirePagePermission } from "@/lib/core/page-guards";
import { ensureSubscription } from "@/lib/services/billing.service";
import { getAllLimitStatuses } from "@/lib/services/limits.service";
import { getPlanFromCatalog, listPlansFromCatalog } from "@/lib/services/pricing-catalog.service";
import { BillingManager } from "@/components/settings/billing-manager";
import { ReferralCard } from "@/components/settings/referral-card";

export const dynamic = "force-dynamic";

/** Settings → Billing (A.5). I.5: only School Owner + Principal see subscription plan/usage. */
export default async function BillingSettingsPage() {
  const user = await requirePagePermission("owner.dashboard");
  const sub = await ensureSubscription(user.tenantId);
  const limits = await getAllLimitStatuses(user.tenantId);
  const plan = await getPlanFromCatalog(sub.planKey);
  const plans = await listPlansFromCatalog();

  const data = {
    subscription: {
      planKey: sub.planKey,
      planName: plan?.name ?? sub.planKey,
      status: sub.status,
      price: sub.grandfatheredPrice,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    },
    limits: limits.map((l) => ({
      metric: l.metric,
      used: l.used,
      limit: l.limit,
      blocked: l.blocked,
      overLimit: l.overLimit,
    })),
    plans: plans.map((p) => ({
      key: p.key,
      name: p.name,
      pricePerTerm: p.pricePerTerm,
      highlights: p.highlights,
    })),
  };

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Billing
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Your NEYO plan, usage and payments. SMS is bought as a separate top-up outside the package.
        </p>
      </div>
      <BillingManager data={data} canManage={true} />
      <ReferralCard />
    </div>
  );
}
