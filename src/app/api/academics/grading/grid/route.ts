import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getMarksGrid, savePaperResults, GradingError } from "@/lib/services/grading-engine.service";
import { savePaperResultsSchema } from "@/lib/validations/grading-engine";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const examId = req.nextUrl.searchParams.get("examId");
    const subjectId = req.nextUrl.searchParams.get("subjectId");
    const classId = req.nextUrl.searchParams.get("classId");
    
    if (!examId || !subjectId || !classId) return fail("INVALID", "Missing params", 400);

    const data = await getMarksGrid(user, examId, subjectId, classId);
    return ok({ data });
  } catch (error) {
    if (error instanceof GradingError) return fail(error.code, error.message, 403);
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const classId = req.nextUrl.searchParams.get("classId");
    if (!classId) return fail("INVALID", "Missing classId", 400);

    const body = await req.json();
    const data = savePaperResultsSchema.parse(body);
    const normalizedResults = data.results.map((r) => ({ ...r, marksScored: r.marksScored ?? null }));

    const res = await savePaperResults(user, data.examId, data.subjectId, classId, normalizedResults);
    return ok({ data: res });
  } catch (error) {
    if (error instanceof GradingError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CLOSED: 423 };
      return fail(error.code, error.message, statusMap[error.code] as any);
    }
    return handleError(error);
  }
}
