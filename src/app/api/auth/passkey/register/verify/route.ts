import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { passkeyRegisterVerifySchema } from "@/lib/validations/auth";
import { verifyRegistration } from "@/lib/services/passkey.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/passkey/register/verify — body: { response, deviceLabel? } */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { response, deviceLabel } = passkeyRegisterVerifySchema.parse(
      await req.json().catch(() => ({}))
    );
    const origin = req.nextUrl.origin;
    const result = await verifyRegistration(user.id, response, deviceLabel, origin);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
