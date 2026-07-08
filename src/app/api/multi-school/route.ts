/**
 * R.4 — Multi-School Parent Accounts API.
 * GET  — the parent's full switcher list (every real linked school + the
 *        one they're currently signed into).
 * POST {action:"start_link", phone} — send a real OTP to the OTHER school's
 *        registered phone (step 1 of linking).
 * POST {action:"confirm_link", phone, code} — verify that OTP and create the
 *        real bidirectional link (step 2).
 * POST {action:"switch", targetUserId} — one-click switch the CURRENT
 *        session to one of the parent's own already-linked schools.
 * POST {action:"unlink", targetUserId} — remove a previously-linked school.
 * Permission: PARENT role only (multi-school switching is a parent feature).
 */
import { NextRequest } from "next/server";
import { getSessionContext } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import {
  myLinkedSchools,
  startSchoolLink,
  confirmSchoolLink,
  switchToLinkedSchool,
  unlinkSchool,
} from "@/lib/services/multi-school.service";
import {
  startLinkSchema,
  confirmLinkSchema,
  switchSchoolSchema,
  unlinkSchoolSchema,
} from "@/lib/validations/multi-school";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return fail("UNAUTHENTICATED", "You must be signed in.", 401);
    if (ctx.user.role !== "PARENT") return fail("PARENT_ONLY", "Multi-school switching is only available for parent accounts.", 403);
    return ok({ schools: await myLinkedSchools(ctx.user.id), currentUserId: ctx.user.id });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return fail("UNAUTHENTICATED", "You must be signed in.", 401);
    if (ctx.user.role !== "PARENT") return fail("PARENT_ONLY", "Multi-school switching is only available for parent accounts.", 403);

    const body = await req.json().catch(() => ({}));
    const action = z.enum(["start_link", "confirm_link", "switch", "unlink"]).parse(body?.action);

    if (action === "start_link") {
      const input = startLinkSchema.parse(body);
      return ok(await startSchoolLink(ctx.user.id, input.phone));
    }

    if (action === "confirm_link") {
      const input = confirmLinkSchema.parse(body);
      return ok(await confirmSchoolLink(ctx.user.id, input.phone, input.code));
    }

    if (action === "switch") {
      const input = switchSchoolSchema.parse(body);
      const result = await switchToLinkedSchool(ctx.token, ctx.user.id, input.targetUserId);
      return ok(result);
    }

    // unlink
    const input = unlinkSchoolSchema.parse(body);
    await unlinkSchool(ctx.user.id, input.targetUserId);
    return ok({ unlinked: true });
  } catch (e) {
    return handleError(e);
  }
}
