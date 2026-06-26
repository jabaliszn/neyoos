import { requirePermission } from "@/lib/core/session";
import { listDeleted } from "@/lib/services/recycle.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/recycle-bin — list soft-deleted items (leadership only). */
export async function GET() {
  try {
    const user = await requirePermission("tenant.manage_settings");
    const items = await listDeleted(user.tenantId);
    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
}
