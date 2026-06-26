import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { updateWebhookSchema } from "@/lib/validations/api-keys";
import { updateWebhook, deleteWebhook } from "@/lib/services/webhook.service";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** PATCH /api/webhooks/:id — toggle active / edit (A.16.4). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission("api.manage");
    const input = updateWebhookSchema.parse(await req.json().catch(() => ({})));
    const updated = await withTenant(user.tenantId, () =>
      updateWebhook(params.id, input)
    );
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "webhook.update",
        entityType: "WebhookSubscription",
        entityId: params.id,
        metadata: JSON.stringify(input),
      },
    });
    return ok({ id: updated.id, active: updated.active });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/webhooks/:id — remove a subscription (A.16.4). */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission("api.manage");
    const result = await withTenant(user.tenantId, () => deleteWebhook(params.id));
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "webhook.delete",
        entityType: "WebhookSubscription",
        entityId: params.id,
      },
    });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
