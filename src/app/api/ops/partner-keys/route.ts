/**
 * Part X — Developer Center 2.0 (founder-requested 2026-07-06).
 * NEYO Ops — SUPER_ADMIN only. Issues a real NEYO_PARTNER-tier API key for
 * NEYO's own future first-party accessories (a NEYO-built fingerprint
 * device, ID-card printer, etc.) against one specific real school's
 * tenant — the SAME real auth/rate-limit/scope mechanism as a school's
 * own key, just a genuinely more privileged, NEYO-vetted tier.
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { createPartnerApiKeySchema } from "@/lib/validations/api-keys";
import { createPartnerApiKey, listPartnerApiKeys, revokeApiKeyAsOps } from "@/lib/services/api-key.service";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("SUPER_ADMIN");
    return ok({ keys: await listPartnerApiKeys() });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const input = createPartnerApiKeySchema.parse(await req.json().catch(() => ({})));
    const created = await createPartnerApiKey(input.tenantId, input, user.id);
    await db.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "platform.partner_api_key_issued",
        entityType: "ApiKey",
        entityId: created.id,
        metadata: JSON.stringify({ name: input.name, keyPrefix: created.keyPrefix }),
      },
    });
    return ok(created, 201);
  } catch (e) {
    return handleError(e);
  }
}
