import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { staffForRelay } from "@/lib/services/reception.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/reception/staff — active staff for the phone-relay picker (A.18.7). */
export async function GET() {
  try {
    const user = await requirePermission("reception.operate");
    const staff = await withTenant(user.tenantId, staffForRelay);
    return ok({ staff });
  } catch (err) {
    return handleError(err);
  }
}
