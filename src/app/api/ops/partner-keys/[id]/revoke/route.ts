/**
 * Part X — Developer Center 2.0. NEYO Ops — SUPER_ADMIN only. Revoke ANY
 * real API key (SCHOOL or NEYO_PARTNER tier) for real security-incident
 * response, across any tenant.
 */
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { revokeApiKeyAsOps } from "@/lib/services/api-key.service";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const result = await revokeApiKeyAsOps(params.id);
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "platform.api_key_revoked_by_ops",
        entityType: "ApiKey",
        entityId: params.id,
        metadata: JSON.stringify({}),
      },
    });
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
