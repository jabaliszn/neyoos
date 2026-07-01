/**
 * J.13 Parent Growth Dashboard.
 * GET  ?studentId=  — full growth dashboard for one of the parent's own children.
 * POST { action: "acknowledge_goal", goalId } — parent acknowledges a teacher goal.
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getParentGrowthDashboard, acknowledgeStudentGoal } from "@/lib/services/parent-growth.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required", 400);
    const data = await getParentGrowthDashboard(user, studentId);
    return ok({ data });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    if (body.action === "acknowledge_goal" && body.goalId) {
      const goal = await acknowledgeStudentGoal(user, body.goalId);
      return ok({ message: "Goal acknowledged", goal });
    }
    return fail("INVALID", "Unknown action", 400);
  } catch (e) {
    return handleError(e);
  }
}
