import { NextRequest } from "next/server";
import { passkeyLoginVerifySchema } from "@/lib/validations/auth";
import { verifyLogin } from "@/lib/services/passkey.service";
import { maybeConvertToTotpChallenge } from "@/lib/services/totp.service";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/core/session";
import { deviceIdFromRequest, setDeviceCookie } from "@/lib/core/device-id";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/passkey/login/verify — body: { email, response }. Sets cookie. */
export async function POST(req: NextRequest) {
  try {
    const { email, response } = passkeyLoginVerifySchema.parse(
      await req.json().catch(() => ({}))
    );
    const deviceId = deviceIdFromRequest(req);
    const ctx = {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
      origin: req.nextUrl.origin,
      deviceId,
    };

    const result = await verifyLogin(email, response, ctx);

    // Respect 2FA if the user also has TOTP enabled.
    const challengeToken = await maybeConvertToTotpChallenge(result, ctx);
    if (challengeToken) {
      return ok({ twoFactorRequired: true, challengeToken });
    }

    const res = ok({
      user: {
        id: result.user.id,
        fullName: result.user.fullName,
        role: result.user.role,
      },
    });
    res.cookies.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: result.expiresAt,
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });
    setDeviceCookie(res, deviceId);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
