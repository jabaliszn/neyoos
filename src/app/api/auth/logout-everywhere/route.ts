import { requireUser, SESSION_COOKIE } from "@/lib/core/session";
import { destroyAllSessionsForUser } from "@/lib/services/auth.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout-everywhere
 * Invalidates every session for the signed-in user (A.1), then clears the
 * current cookie so this device is signed out too.
 */
export async function POST() {
  try {
    const user = await requireUser();
    const removed = await destroyAllSessionsForUser(user.id);

    const response = ok({ sessionsRemoved: removed });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (err) {
    return handleError(err);
  }
}
