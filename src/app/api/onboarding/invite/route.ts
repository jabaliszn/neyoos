import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { inviteSchema } from "@/lib/validations/onboarding";
import { inviteStaff } from "@/lib/services/onboarding.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/onboarding/invite — invite staff (leadership only). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("user.manage_roles");
    const { invites } = inviteSchema.parse(await req.json().catch(() => ({})));
    const result = await inviteStaff(user.tenantId, invites);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
