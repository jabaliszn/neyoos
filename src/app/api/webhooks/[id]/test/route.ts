import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { sendTestEvent } from "@/lib/services/webhook.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/webhooks/:id/test — send a test delivery (A.16.5/6). */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission("api.manage");
    const result = await withTenant(user.tenantId, () => sendTestEvent(params.id));
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
