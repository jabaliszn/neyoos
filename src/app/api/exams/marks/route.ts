/**
 * B.5 marks entry. GET sheet ?examId=&subjectId=&classId= · POST save (autosave).
 * Permission: exam.enter_marks; teacher row-scoping enforced in the service.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { marksSchema } from "@/lib/validations/exams";
import { getMarksSheet, saveMarks } from "@/lib/services/exam.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("exam.enter_marks");
    const sp = req.nextUrl.searchParams;
    const examId = sp.get("examId"); const subjectId = sp.get("subjectId"); const classId = sp.get("classId");
    if (!examId || !subjectId || !classId) return fail("MISSING", "examId, subjectId and classId required.", 400);
    return ok(await getMarksSheet(user, examId, subjectId, classId));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("exam.enter_marks");
    const input = marksSchema.parse(await req.json());
    return ok(await saveMarks(user, input));
  } catch (e) {
    return handleError(e);
  }
}
