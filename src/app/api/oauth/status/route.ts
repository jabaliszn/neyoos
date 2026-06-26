import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { oauthProviderStatus } from "@/lib/services/oauth-vault.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ providers: await oauthProviderStatus(user) });
  } catch (error) { return handleError(error); }
}
