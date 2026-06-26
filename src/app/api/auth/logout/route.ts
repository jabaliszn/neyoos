import { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/core/session";
import { destroySession } from "@/lib/services/auth.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — deletes the session and clears the cookie. */
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) await destroySession(token);

    const response = ok({ loggedOut: true });
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
