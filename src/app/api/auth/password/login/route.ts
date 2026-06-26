import { NextRequest } from "next/server";
import { loginEmailSchema } from "@/lib/validations/auth";
import { loginWithPassword } from "@/lib/services/auth.service";
import { maybeConvertToTotpChallenge } from "@/lib/services/totp.service";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/core/session";
import { deviceIdFromRequest, setDeviceCookie } from "@/lib/core/device-id";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/password/login — body: { email, password }. Sets session cookie. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = loginEmailSchema.parse(body);

    const deviceId = deviceIdFromRequest(req);
    const ctx = {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
      deviceId,
    };
    const result = await loginWithPassword(email, password, ctx);

    const challengeToken = await maybeConvertToTotpChallenge(result, ctx);
    if (challengeToken) {
      return ok({ twoFactorRequired: true, challengeToken });
    }

    const response = ok({
      user: {
        id: result.user.id,
        fullName: result.user.fullName,
        role: result.user.role,
      },
    });

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
    return handleError(err);
  }
}
