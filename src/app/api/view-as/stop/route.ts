import { getSessionContext } from "@/lib/core/session";
import { stopViewAs } from "@/lib/services/view-as.service";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/view-as/stop — return to your own identity. */
export async function POST() {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return fail("UNAUTHENTICATED", "You must be signed in.", 401);
    if (ctx.isImpersonating) await stopViewAs(ctx.token);
    return ok({ stopped: true });
  } catch (err) {
    return handleError(err);
  }
}
