import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { entranceExamPaperSchema } from "@/lib/validations/entrance-exam";
import { listEntranceExamPapers, saveEntranceExamPaper } from "@/lib/services/entrance-exam.service";

export const dynamic = "force-dynamic";

/** GET /api/admissions/entrance-exams — exact-class entrance/interview papers. */
export async function GET() {
  try {
    const user = await requirePermission("student.view");
    const papers = await listEntranceExamPapers(user);
    return ok({ papers });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/admissions/entrance-exams — save one paper for one exact class/stream. */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.create");
    const body = await req.json().catch(() => ({}));
    const input = entranceExamPaperSchema.parse(body);
    const result = await saveEntranceExamPaper(user, input);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
