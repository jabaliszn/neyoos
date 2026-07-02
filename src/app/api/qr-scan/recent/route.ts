import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { recentScans } from "@/lib/services/qr-scan.service";

export const dynamic = "force-dynamic";

/** GET /api/qr-scan/recent — real scan audit trail for the school. */
export async function GET() {
  try {
    const user = await requirePermission("security.view");
    const scans = await recentScans(user);
    return ok({ scans });
  } catch (err) {
    return handleError(err);
  }
}
