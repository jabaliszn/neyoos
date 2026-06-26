import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { disconnectOAuth, oauthProviderSchema } from "@/lib/services/oauth-vault.service";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { provider: string } }) {
  try {
    const user = await requireUser();
    const provider = oauthProviderSchema.parse(params.provider);
    return ok(await disconnectOAuth(user, provider));
  } catch (error) { return handleError(error); }
}
