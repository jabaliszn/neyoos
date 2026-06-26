import { NextRequest } from "next/server";
import { requestMagicLinkSchema } from "@/lib/validations/auth";
import { requestMagicLink } from "@/lib/services/magic-link.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/magic/request — body: { email } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = requestMagicLinkSchema.parse(body);

    const result = await requestMagicLink(email);

    // Same response whether the email is registered or not (no enumeration).
    return ok({
      email,
      ...(result.devLink ? { devLink: result.devLink } : {}),
    });
  } catch (err) {
    return handleError(err);
  }
}
