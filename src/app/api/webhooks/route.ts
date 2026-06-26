import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { createWebhookSchema } from "@/lib/validations/api-keys";
import { createWebhook, listWebhooks } from "@/lib/services/webhook.service";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/webhooks — list the tenant's webhook subscriptions (A.16.4). */
export async function GET() {
  try {
    const user = await requirePermission("api.manage");
    const webhooks = await withTenant(user.tenantId, listWebhooks);
    return ok({ webhooks });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/webhooks — register a webhook endpoint (A.16.4). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("api.manage");
    const input = createWebhookSchema.parse(await req.json().catch(() => ({})));
    const created = await withTenant(user.tenantId, () => createWebhook(input));
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "webhook.create",
        entityType: "WebhookSubscription",
        entityId: created.id,
        metadata: JSON.stringify({ url: input.url, events: input.events }),
      },
    });
    return ok(
      {
        id: created.id,
        url: created.url,
        signingSecret: created.signingSecret,
      },
      201
    );
  } catch (err) {
    return handleError(err);
  }
}
