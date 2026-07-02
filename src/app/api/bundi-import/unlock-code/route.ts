import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { checkUnlockCode } from "@/lib/services/bundi-import.service";
import { redeemUnlockCodeSchema } from "@/lib/validations/bundi-import";

export const dynamic = "force-dynamic";

/** POST /api/bundi-import/unlock-code — check a code is valid for this school (does not consume it). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.create");
    const input = redeemUnlockCodeSchema.parse(await req.json().catch(() => ({})));
    const result = await checkUnlockCode(user.tenantId, input.code);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
