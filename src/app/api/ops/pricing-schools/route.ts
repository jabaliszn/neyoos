/**
 * Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06).
 * NEYO Ops — SUPER_ADMIN only. The real "Schools & Their Current Pricing"
 * list (V.7): every real school's current SIZE_BASED_V2 price plus its
 * latest real TenantPricingSnapshot, for the Ops Pricing Engine tab.
 */
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { listSchoolsWithPricing } from "@/lib/services/pricing-engine.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("SUPER_ADMIN");
    return ok({ schools: await listSchoolsWithPricing() });
  } catch (e) {
    return handleError(e);
  }
}
