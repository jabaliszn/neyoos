import { NextRequest } from "next/server";
import { signupSchema } from "@/lib/validations/onboarding";
import { signupSchool } from "@/lib/services/onboarding.service";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/core/session";
import { enforceRate, clientIp } from "@/lib/security/rate-limit";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/onboarding/signup — PUBLIC. Creates a school + owner, logs in. */
export async function POST(req: NextRequest) {
  try {
    // A.14: throttle school signups per IP (anti-abuse).
    enforceRate(`signup:${clientIp(req)}`, 5, 3600); // 5 / hour / IP
    const input = signupSchema.parse(await req.json().catch(() => ({})));
    const result = await signupSchool(input, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
    });

    const res = ok({
      tenantSlug: result.tenantSlug,
      ownerName: result.ownerName,
    });
    res.cookies.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: result.sessionExpiry,
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });
    return res;
  } catch (err) {
    return handleError(err);
  }
}
