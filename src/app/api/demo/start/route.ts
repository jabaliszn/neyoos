/**
 * G.14 — start a Day-One demo. PUBLIC, rate-limited. Spins a sandboxed, time-boxed
 * tenant with real Kenyan data and logs the visitor in as the owner.
 */
import { NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/core/session";
import { deviceIdFromRequest, setDeviceCookie } from "@/lib/core/device-id";
import { enforceRate, clientIp } from "@/lib/security/rate-limit";
import { ok, handleError } from "@/lib/api/respond";
import { createDemoSchool } from "@/lib/services/demo.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // anti-abuse: 5 demo schools / hour / IP.
    enforceRate(`demo:${clientIp(req)}`, 5, 3600);
    const deviceId = deviceIdFromRequest(req);
    const result = await createDemoSchool({
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
      deviceId,
    });
    const res = ok({ tenantSlug: result.tenantSlug, demoExpiresAt: result.demoExpiresAt });
    res.cookies.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: result.sessionExpiry,
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });
    setDeviceCookie(res, deviceId);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
