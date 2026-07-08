import { NextRequest } from "next/server";
import { signupSchema } from "@/lib/validations/onboarding";
import { signupSchool } from "@/lib/services/onboarding.service";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/core/session";
import { enforceRate, clientIp } from "@/lib/security/rate-limit";
import { ok, handleError } from "@/lib/api/respond";
import { markQuoteRequestLive } from "@/lib/services/school-quote.service";

export const dynamic = "force-dynamic";

/** POST /api/onboarding/signup — PUBLIC. Creates a school + owner, logs in.
 * Part V (2026-07-06): an optional real `quoteRequestId` links this new
 * school back to the real quote request it came from, completing the real
 * demo -> quote -> accept -> self-serve-live audit trail (V.6). */
export async function POST(req: NextRequest) {
  try {
    // A.14: throttle school signups per IP (anti-abuse).
    enforceRate(`signup:${clientIp(req)}`, 5, 3600); // 5 / hour / IP
    const body = await req.json().catch(() => ({}));
    const quoteRequestId = typeof body?.quoteRequestId === "string" ? body.quoteRequestId : undefined;
    const input = signupSchema.parse(body);
    const result = await signupSchool(input, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
    });
    if (quoteRequestId) {
      try {
        await markQuoteRequestLive(quoteRequestId, result.tenantId);
      } catch {
        // best-effort — never block a real, successful signup over a
        // real quote-request linkage failure (e.g. an already-live request)
      }
    }

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
