import { getSessionContext } from "@/lib/core/session";
import { stopImpersonation } from "@/lib/services/impersonation.service";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/admin/impersonate/stop — return to the admin's own identity. */
export async function POST() {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return fail("UNAUTHENTICATED", "You must be signed in.", 401);
    if (ctx.isImpersonating) {
      await stopImpersonation(ctx.token);
    }
    return ok({ stopped: true });
  } catch (err) {
    return handleError(err);
  }
}
