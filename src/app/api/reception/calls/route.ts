import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { phoneMessageSchema } from "@/lib/validations/reception";
import { relayPhoneMessage, todayPhoneMessages } from "@/lib/services/reception.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/reception/calls — today's relayed phone messages (A.18.7). */
export async function GET() {
  try {
    const user = await requirePermission("reception.operate");
    const calls = await withTenant(user.tenantId, todayPhoneMessages);
    return ok({ calls });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/reception/calls — relay a phone message into a staff inbox (A.18.7). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("reception.operate");
    const input = phoneMessageSchema.parse(await req.json().catch(() => ({})));
    const result = await relayPhoneMessage(user.tenantId, input, {
      id: user.id,
      name: user.fullName,
    });
    return ok(result, 201);
  } catch (err) {
    return handleError(err);
  }
}
