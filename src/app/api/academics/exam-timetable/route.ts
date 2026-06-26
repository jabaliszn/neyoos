import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { examTimetableActionSchema } from "@/lib/validations/exam-timetable";
import { createExamTimetableSlot, deleteExamTimetableSlot, examTimetableBoard } from "@/lib/services/exam-timetable.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("exam.view");
    return ok(await examTimetableBoard(user, { classId: req.nextUrl.searchParams.get("classId") || undefined }));
  } catch (err) { return handleError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("exam.manage");
    const input = examTimetableActionSchema.parse(await req.json().catch(() => ({})));
    if (input.action === "delete") return ok(await deleteExamTimetableSlot(user, input.id));
    return ok(await createExamTimetableSlot(user, input), 201);
  } catch (err) { return handleError(err); }
}
