import { NextRequest } from "next/server";
import { passkeyLoginOptionsSchema } from "@/lib/validations/auth";
import { getLoginOptions } from "@/lib/services/passkey.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/passkey/login/options — body: { email } */
export async function POST(req: NextRequest) {
  try {
    const { email } = passkeyLoginOptionsSchema.parse(
      await req.json().catch(() => ({}))
    );
    const options = await getLoginOptions(email);
    return ok({ options });
  } catch (err) {
    return handleError(err);
  }
}
