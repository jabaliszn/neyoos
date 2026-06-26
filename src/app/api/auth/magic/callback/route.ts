import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/services/magic-link.service";
import { maybeConvertToTotpChallenge } from "@/lib/services/totp.service";
import { AuthServiceError } from "@/lib/services/auth.service";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/core/session";
import { deviceIdFromRequest, setDeviceCookie } from "@/lib/core/device-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/magic/callback?token=...
 * Consumes the link, sets the session cookie, and redirects:
 *  - success  -> /dashboard
 *  - failure  -> /login/magic?error=CODE  (a calm error screen)
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const base = req.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(new URL("/login/magic?error=INVALID_CODE", base));
  }

  try {
    const deviceId = deviceIdFromRequest(req);
    const ctx = {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
      deviceId,
    };
    const result = await consumeMagicLink(token, ctx);

    // If 2FA is on, send the user to the login page to complete the 2nd factor.
    const challengeToken = await maybeConvertToTotpChallenge(result, ctx);
    if (challengeToken) {
      return NextResponse.redirect(
        new URL(`/login?challenge=${challengeToken}`, base)
      );
    }

    const response = NextResponse.redirect(new URL("/dashboard", base));
    response.cookies.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: result.expiresAt,
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });
    setDeviceCookie(response, deviceId);
    return response;
  } catch (err) {
    const code = err instanceof AuthServiceError ? err.code : "INVALID_CODE";
    return NextResponse.redirect(
      new URL(`/login/magic?error=${code}`, base)
    );
  }
}
