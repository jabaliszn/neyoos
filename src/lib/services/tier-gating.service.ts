/**
 * J.23 — Revenue tier-gating engine.
 *
 * A premium feature is unlocked for a school if ANY of:
 *   1. its current plan's `includedModules` contains the feature key (e.g. Elite), OR
 *   2. it has bought the matching add-on (`subscription.addOns`), OR
 *   3. NEYO Ops manually granted it (per-school override, comp/pilot/VIP).
 *
 * `requireRevenueFeature` additionally enforces the master ON/OFF Part-J toggle:
 * if NEYO Ops switches the whole feature OFF platform-wide, NOBODY gets it
 * (FlagError → 403), regardless of payment.
 */
import { PLANS } from "@/lib/core/plans";
import { db } from "@/lib/db";
import { getRevenueFeature } from "@/lib/core/revenue-features";
import { hasFeatureGrant } from "@/lib/services/feature-grants.service";
import { assertJFeatureEnabled } from "@/lib/services/platform-flags.service";
import type { SessionUser } from "@/lib/core/session";

export class TierGatingError extends Error {
  code: "PAYMENT_REQUIRED";
  featureKey: string;
  constructor(message: string, featureKey: string) {
    super(message);
    this.name = "TierGatingError";
    this.code = "PAYMENT_REQUIRED";
    this.featureKey = featureKey;
  }
}

function parseAddOns(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Does this school have an entitlement (plan / add-on / manual grant) for the
 * feature? Does NOT consider the master ON/OFF toggle — use `hasRevenueFeature`
 * / `requireRevenueFeature` for the fully-gated check.
 */
export async function hasEntitlement(tenantId: string, featureKey: string): Promise<boolean> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });
  if (!tenant) throw new Error("Tenant not found");

  const planKey = tenant.subscription?.planKey || "free_karibu";
  const planDef = PLANS.find((p) => p.key === planKey);

  // 1. plan includes it (e.g. Elite bundles all premium features)
  if (planDef && planDef.includedModules.includes(featureKey)) return true;

  // 2. school bought the matching add-on à la carte
  if (parseAddOns(tenant.subscription?.addOns).includes(featureKey)) return true;

  // 3. NEYO Ops manual grant (comp / pilot / VIP)
  if (await hasFeatureGrant(tenantId, featureKey)) return true;

  return false;
}

/**
 * Throws TierGatingError if the tenant has no entitlement (plan/add-on/grant).
 * Kept for backwards-compat with the analytics route + existing call-sites.
 */
export async function requirePremiumFeature(tenantId: string, featureKey: string): Promise<boolean> {
  if (await hasEntitlement(tenantId, featureKey)) return true;
  const def = getRevenueFeature(featureKey);
  throw new TierGatingError(
    `${def?.label ?? "This feature"} requires a higher plan or the "${def?.label ?? featureKey}" add-on.`,
    featureKey,
  );
}

/** Safe boolean for UI rendering — entitlement only (ignores toggle). */
export async function hasPremiumFeature(tenantId: string, featureKey: string): Promise<boolean> {
  try {
    return await hasEntitlement(tenantId, featureKey);
  } catch {
    return false;
  }
}

/**
 * Fully-gated check for an API entry point:
 *   (a) master Part-J toggle must be ON (else FlagError → 403), AND
 *   (b) the school must have an entitlement (else TierGatingError → 402).
 */
export async function requireRevenueFeature(user: SessionUser, featureKey: string): Promise<void> {
  const def = getRevenueFeature(featureKey);
  if (def) {
    // (a) master ON/OFF switch — throws FlagError("FORBIDDEN") if switched off
    await assertJFeatureEnabled(def.toggleId);
  }
  // (b) paid entitlement
  await requirePremiumFeature(user.tenantId, featureKey);
}

/** Boolean variant of the fully-gated check (toggle + entitlement). */
export async function hasRevenueFeature(user: SessionUser, featureKey: string): Promise<boolean> {
  try {
    await requireRevenueFeature(user, featureKey);
    return true;
  } catch {
    return false;
  }
}
