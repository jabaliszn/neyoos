import { NextRequest } from "next/server";
import { z } from "zod";
import { solveTotpChallenge } from "@/lib/services/totp.service";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/core/session";
import { deviceIdFromRequest, setDeviceCookie } from "@/lib/core/device-id";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  challengeToken: z.string().min(1, "Missing challenge"),
  token: z.string().trim().min(6, "Enter your 6-digit code").max(14),
});

/** POST /api/auth/2fa/verify — the login second step. Sets the session cookie. */
export async function POST(req: NextRequest) {
  try {
    const { challengeToken, token } = schema.parse(
      await req.json().catch(() => ({}))
    );

    const deviceId = deviceIdFromRequest(req);
    const result = await solveTotpChallenge(challengeToken, token, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
      deviceId,
    });

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
