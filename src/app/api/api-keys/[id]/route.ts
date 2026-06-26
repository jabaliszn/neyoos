import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { revokeApiKey } from "@/lib/services/api-key.service";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** DELETE /api/api-keys/:id — revoke a key (A.16.1). */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission("api.manage");
    const result = await withTenant(user.tenantId, () => revokeApiKey(params.id));
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "api_key.revoke",
        entityType: "ApiKey",
        entityId: params.id,
      },
    });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
