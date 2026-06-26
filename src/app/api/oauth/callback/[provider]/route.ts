import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/api/respond";
import { completeOAuthCallback, oauthProviderSchema } from "@/lib/services/oauth-vault.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  try {
    const provider = oauthProviderSchema.parse(params.provider);
    const state = req.nextUrl.searchParams.get("state") || "";
    const code = req.nextUrl.searchParams.get("code") || "";
    const result = await completeOAuthCallback({ provider, state, code });
    return NextResponse.redirect(new URL(`${result.redirectTo}?oauth=${provider}&linked=${result.linked ? "1" : "0"}`, req.url));
  } catch (error) { return handleError(error); }
}

export async function POST(req: NextRequest, ctx: { params: { provider: string } }) {
  const form = await req.formData().catch(() => null);
  const provider = oauthProviderSchema.parse(ctx.params.provider);
  const state = String(form?.get("state") || "");
  const code = String(form?.get("code") || "");
  const result = await completeOAuthCallback({ provider, state, code });
  return NextResponse.redirect(new URL(`${result.redirectTo}?oauth=${provider}&linked=${result.linked ? "1" : "0"}`, req.url));
}
