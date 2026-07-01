/**
 * PART J.6 — Skills Passport API.
 *
 * GET /api/skills-passport?studentId=...
 *   Returns row-scoped learner Skills Passport profile view.
 * POST /api/skills-passport
 *   Runs one validated skills passport action (record_skill_rating, remove_skill_rating).
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { requireRevenueFeature } from "@/lib/services/tier-gating.service";
import { ok, fail, handleError } from "@/lib/api/respond";
import { skillsPassportActionSchema } from "@/lib/validations/skills-passport";
import {
  getSkillsPassportProfile,
  recordSkillRating,
  removeSkillRating,
} from "@/lib/services/skills-passport.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    await requireRevenueFeature(user, "skills_passport");
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId parameter is required.", 422);

    return ok({ profile: await getSkillsPassportProfile(user, studentId) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    await requireRevenueFeature(user, "skills_passport");
    const input = skillsPassportActionSchema.parse(await req.json());
    switch (input.action) {
      case "record_skill_rating":
        return ok({ result: await recordSkillRating(user, input.payload) });
      case "remove_skill_rating":
        return ok({ result: await removeSkillRating(user, input.payload.id) });
      default: {
        const _exhaustive: never = input;
        return ok({ result: _exhaustive });
      }
    }
  } catch (error) {
    return handleError(error);
  }
}
