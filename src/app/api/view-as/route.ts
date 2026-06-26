import { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/core/session";
import { startViewAs } from "@/lib/services/view-as.service";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ targetUserId: z.string().min(1) });

/** POST /api/view-as — start a read-only in-school preview. Leadership only. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return fail("UNAUTHENTICATED", "You must be signed in.", 401);
    if (ctx.isImpersonating) {
      return fail("ALREADY_ACTIVE", "Stop the current preview first.", 409);
    }
    const { targetUserId } = schema.parse(await req.json().catch(() => ({})));
    // Authorize using the REAL user (ctx.user == realUser when not impersonating).
    const result = await startViewAs(
      ctx.token,
      {
        id: ctx.user.id,
        role: ctx.user.role,
        tenantId: ctx.user.tenantId,
        fullName: ctx.user.fullName,
      },
      targetUserId
    );
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
