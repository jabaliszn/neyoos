import { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/core/session";
import { startImpersonation } from "@/lib/services/impersonation.service";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ targetUserId: z.string().min(1, "Missing target user") });

/** POST /api/admin/impersonate — body: { targetUserId }. SUPER_ADMIN only. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return fail("UNAUTHENTICATED", "You must be signed in.", 401);
    if (ctx.isImpersonating) {
      return fail("ALREADY_IMPERSONATING", "Stop the current session first.", 409);
    }
    if (ctx.user.role !== "SUPER_ADMIN") {
      return fail("FORBIDDEN", "Only NEYO admins can impersonate.", 403);
    }

    const { targetUserId } = schema.parse(await req.json().catch(() => ({})));
    const result = await startImpersonation(ctx.token, ctx.user.id, targetUserId);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
