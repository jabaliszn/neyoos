/**
 * J.23 — Revenue & Product Packaging registry.
 *
 * Founder requirement (2026-06-29): "Fix J.23 fully AND everything can be
 * controlled in NEYO Ops, same too pricing."
 *
 * Each premium revenue feature maps to:
 *  - `key`             — the add-on / module key used in `core/plans.ts` (ADD_ONS)
 *                        and in `subscription.addOns`. Buying this add-on, OR being
 *                        on a plan whose `includedModules` contains it, unlocks it.
 *  - `label`           — human name for NEYO Ops.
 *  - `checklistLine`   — which J.23 checklist line it backs.
 *
 * Control surfaces (all in NEYO Ops):
 *  1. Pricing — editable via the pricing catalog (`pricing-catalog.service.ts`).
 *  2. Master ON/OFF — each one is a Part-J feature toggle (`j-features.ts`, J.23.x).
 *  3. Paid-tier gating — `tier-gating.service.ts` `requirePremiumFeature` checks
 *     plan.includedModules + bought add-ons + per-school manual grants.
 *  4. Per-school manual grant/override — `feature-grants.service.ts`.
 */

export interface RevenueFeatureDef {
  /** add-on / module key (matches ADD_ONS + subscription.addOns) */
  key: string;
  /** Part-J feature-toggle id (master ON/OFF switch) */
  toggleId: string;
  label: string;
  description: string;
  checklistLine: string;
}

export const REVENUE_FEATURES: RevenueFeatureDef[] = [
  {
    key: "skills_passport",
    toggleId: "J.23.1",
    label: "Skills Passport & Portfolio",
    description: "Premium learner talent + digital evidence passport.",
    checklistLine: "Skills Passport as paid add-on for premium schools.",
  },
  {
    key: "extra_storage",
    toggleId: "J.23.2",
    label: "Portfolio Storage Add-on",
    description: "Extra Storage Vault quota for portfolio evidence.",
    checklistLine: "Portfolio storage add-on linked to Storage Vault quota.",
  },
  {
    key: "pathway_guidance",
    toggleId: "J.23.3",
    label: "Career Discovery & Pathways",
    description: "Career interest tracking + Senior School pathway mapping.",
    checklistLine: "Career guidance/pathway module as Pro/Elite feature.",
  },
  {
    key: "advanced_analytics",
    toggleId: "J.23.4",
    label: "Advanced School Analytics",
    description: "Systemic insights, correlations and intervention alerts.",
    checklistLine: "Advanced analytics as Pro/Elite feature.",
  },
  {
    key: "custom_reports",
    toggleId: "J.23.5",
    label: "Modular Report Builder",
    description: "No-code custom report-card template design.",
    checklistLine: "Custom report-template design as paid service or Elite feature.",
  },
  {
    key: "transfer_passport",
    toggleId: "J.23.6",
    label: "Inter-School Transfer Passport",
    description: "Premium portable learner transfer record between schools.",
    checklistLine: "Inter-school transfer passport as premium trust feature.",
  },
];

export const REVENUE_FEATURE_KEYS = REVENUE_FEATURES.map((f) => f.key);

export function getRevenueFeature(key: string): RevenueFeatureDef | undefined {
  return REVENUE_FEATURES.find((f) => f.key === key);
}

export function revenueFeatureByToggle(toggleId: string): RevenueFeatureDef | undefined {
  return REVENUE_FEATURES.find((f) => f.toggleId === toggleId);
}
