/**
 * B.5 exams. GET list (exam.view) · POST create (exam.manage).
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { examSchema } from "@/lib/validations/exams";
import { listExams, createExam } from "@/lib/services/exam.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("exam.view");
    return ok({ exams: await listExams(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("exam.manage");
    const input = examSchema.parse(await req.json());
    return ok(await createExam(user, input));
  } catch (e) {
    return handleError(e);
  }
}
