import { requireUser } from "@/lib/core/session";
import { getRegistrationOptions } from "@/lib/services/passkey.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/passkey/register/options — registration options for current user. */
export async function POST() {
  try {
    const user = await requireUser();
    const options = await getRegistrationOptions(user.id);
    return ok({ options });
  } catch (err) {
    return handleError(err);
  }
}
