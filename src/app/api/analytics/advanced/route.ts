import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { requirePremiumFeature, TierGatingError } from "@/lib/services/tier-gating.service";
import { ok, handleError } from "@/lib/api/respond";
import { getAdvancedAnalytics } from "@/lib/services/advanced-analytics.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("reports.view"); // Principal/Leadership level
    await requirePremiumFeature(user.tenantId, "advanced_analytics");
    const data = await getAdvancedAnalytics(user);
    return ok({ data });
  } catch (error) {
    if (error instanceof TierGatingError) {
      return fail("PAYMENT_REQUIRED", error.message, 402);
    }
    return handleError(error);
  }
}
