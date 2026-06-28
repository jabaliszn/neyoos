import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getLessonPlanningAnalytics } from "@/lib/services/academics.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const classId = req.nextUrl.searchParams.get("classId");
    const subjectId = req.nextUrl.searchParams.get("subjectId");
    if (!classId || !subjectId) return fail("INVALID", "classId and subjectId required", 400);
    
    const analytics = await getLessonPlanningAnalytics(user, classId, subjectId);
    return ok({ data: analytics });
  } catch (error) {
    return handleError(error);
  }
}
