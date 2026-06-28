import { tenantDb } from "@/lib/core/tenant-db";
import { PLANS, ADD_ONS } from "@/lib/core/plans";
import { db } from "@/lib/db";

export class TierGatingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TierGatingError";
  }
}

/**
 * Validates if the tenant's current plan or bought add-ons include the requested feature.
 * @param tenantId The school tenant
 * @param featureKey The premium feature key (e.g., "skills_passport", "advanced_analytics")
 */
export async function requirePremiumFeature(tenantId: string, featureKey: string): Promise<boolean> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true }
  });

  if (!tenant) throw new Error("Tenant not found");
  
  // No subscription means free tier
  const planKey = tenant.subscription?.planKey || "free_karibu";
  const planDef = PLANS.find(p => p.key === planKey);
  
  // If the core plan includes it (e.g. Elite includes advanced_analytics)
  if (planDef && planDef.includedModules.includes(featureKey)) {
    return true;
  }

  throw new TierGatingError("Feature requires a higher tier plan or an add-on.");
}

/** Safe wrapper that returns a boolean for UI rendering instead of throwing */
export async function hasPremiumFeature(tenantId: string, featureKey: string): Promise<boolean> {
  try {
    await requirePremiumFeature(tenantId, featureKey);
    return true;
  } catch (e) {
    return false;
  }
}
