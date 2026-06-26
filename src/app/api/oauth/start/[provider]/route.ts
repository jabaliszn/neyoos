import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { oauthProviderSchema, startOAuthLink } from "@/lib/services/oauth-vault.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  try {
    const user = await requireUser();
    const provider = oauthProviderSchema.parse(params.provider);
    const body = await req.json().catch(() => ({}));
    return ok(await startOAuthLink(user, provider, body.redirectTo || "/settings/security"));
  } catch (error) { return handleError(error); }
}
