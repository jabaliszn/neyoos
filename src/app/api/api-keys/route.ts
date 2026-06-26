import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { createApiKeySchema } from "@/lib/validations/api-keys";
import { createApiKey, listApiKeys } from "@/lib/services/api-key.service";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/api-keys — list the tenant's API keys (A.16.1). */
export async function GET() {
  try {
    const user = await requirePermission("api.manage");
    const keys = await withTenant(user.tenantId, listApiKeys);
    return ok({ keys });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/api-keys — create a key; returns the secret ONCE (A.16.1). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("api.manage");
    const input = createApiKeySchema.parse(await req.json().catch(() => ({})));
    const created = await withTenant(user.tenantId, () =>
      createApiKey(input, user.id)
    );
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "api_key.create",
        entityType: "ApiKey",
        entityId: created.id,
        metadata: JSON.stringify({ name: input.name, keyPrefix: created.keyPrefix }),
      },
    });
    return ok(created, 201);
  } catch (err) {
    return handleError(err);
  }
}
