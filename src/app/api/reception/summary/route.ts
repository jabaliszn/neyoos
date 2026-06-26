import { requirePermission } from "@/lib/core/session";
import { dayEndSummary } from "@/lib/services/reception.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/reception/summary — day-end summary (A.18.8). */
export async function GET() {
  try {
    const user = await requirePermission("reception.operate");
    const summary = await dayEndSummary(user.tenantId);
    return ok(summary);
  } catch (err) {
    return handleError(err);
  }
}
