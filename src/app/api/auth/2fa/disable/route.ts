import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { verifyTotpSchema } from "@/lib/validations/auth";
import { disableTotp } from "@/lib/services/totp.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/2fa/disable — body: { token }. Turns 2FA off after verifying. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { token } = verifyTotpSchema.parse(await req.json().catch(() => ({})));
    await disableTotp(user.id, token);
    return ok({ enabled: false });
  } catch (err) {
    return handleError(err);
  }
}
