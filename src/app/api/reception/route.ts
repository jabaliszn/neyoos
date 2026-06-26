import { requirePermission } from "@/lib/core/session";
import { receptionDashboard } from "@/lib/services/reception.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/reception — the front-desk dashboard data for today (A.18.1). */
export async function GET() {
  try {
    const user = await requirePermission("reception.operate");
    const data = await receptionDashboard(user.tenantId);
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
