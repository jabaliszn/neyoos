import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { verifyTotpSchema } from "@/lib/validations/auth";
import { enableTotp } from "@/lib/services/totp.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/2fa/enable — body: { token }. Confirms + returns recovery codes. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { token } = verifyTotpSchema.parse(await req.json().catch(() => ({})));
    const { recoveryCodes } = await enableTotp(user.id, token);
    return ok({ enabled: true, recoveryCodes });
  } catch (err) {
    return handleError(err);
  }
}
