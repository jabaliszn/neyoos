import { requireUser } from "@/lib/core/session";
import { startTotpSetup } from "@/lib/services/totp.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/2fa/setup — returns the QR + secret to scan. */
export async function POST() {
  try {
    const user = await requireUser();
    const { secret, otpauthUri, qrDataUrl } = await startTotpSetup(user.id);
    return ok({ secret, otpauthUri, qrDataUrl });
  } catch (err) {
    return handleError(err);
  }
}
