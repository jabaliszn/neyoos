import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { requireRevenueFeature } from "@/lib/services/tier-gating.service";
import { ok, handleError } from "@/lib/api/respond";
import { getAdvancedAnalytics } from "@/lib/services/advanced-analytics.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("reports.view"); // Principal/Leadership level
    await requireRevenueFeature(user, "advanced_analytics");
    const data = await getAdvancedAnalytics(user);
    return ok({ data });
  } catch (error) {
    return handleError(error);
  }
}
