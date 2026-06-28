/**
 * PART J.8 — Learning Journey Timeline API.
 *
 * GET /api/learner-journey?studentId=...&mode=staff|parent
 *   Returns a unified learner journey timeline aggregated from existing modules.
 *
 * Supported optional query params:
 * - from=YYYY-MM-DD
 * - to=YYYY-MM-DD
 * - source=EXAM|ASSESSMENT|ATTENDANCE|DISCIPLINE|COMPETENCY|SKILLS|PORTFOLIO|CERTIFICATE|SYSTEM
 * - limit=1..200
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { learnerJourneyQuerySchema } from "@/lib/validations/learner-journey";
import { getLearnerJourneyTimeline } from "@/lib/services/learner-journey.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId parameter is required.", 422);

    const query = learnerJourneyQuerySchema.parse({
      studentId,
      mode: req.nextUrl.searchParams.get("mode") ?? undefined,
      from: req.nextUrl.searchParams.get("from") ?? undefined,
      to: req.nextUrl.searchParams.get("to") ?? undefined,
      source: req.nextUrl.searchParams.get("source") ?? undefined,
      limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    });

    return ok({ timeline: await getLearnerJourneyTimeline(user, query) });
  } catch (error) {
    return handleError(error);
  }
}
