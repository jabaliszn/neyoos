/**
 * B.13 LMS — family portal side (shared parent+student portal).
 * GET  ?view=quizzes&studentId=            — published quizzes + my results
 * GET  ?view=paper&quizId=&studentId=      — quiz paper WITHOUT answers
 * POST {action:"submitHomework", homeworkId, text?, fileUrl?, fileName?, studentId}
 * POST {action:"attemptQuiz", quizId, answers[], studentId}
 * Permission: portal.parent. Row-scoped to own children / own record.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { submissionCreateSchema, quizAttemptSchema } from "@/lib/validations/lms";
import { submitHomework, quizzesForStudent, getQuizPaper, submitQuizAttempt } from "@/lib/services/lms.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("portal.parent");
    const sp = req.nextUrl.searchParams;
    const studentId = sp.get("studentId");
    if (!studentId) return fail("MISSING", "studentId required.", 400);
    if (sp.get("view") === "paper") {
      const quizId = sp.get("quizId");
      if (!quizId) return fail("MISSING", "quizId required.", 400);
      return ok(await getQuizPaper(user, quizId, studentId));
    }
    return ok({ quizzes: await quizzesForStudent(user, studentId) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("portal.parent");
    const body = await req.json().catch(() => ({}));
    const action = z.object({ action: z.enum(["submitHomework", "attemptQuiz"]) }).parse(body).action;
    if (action === "submitHomework") {
      const input = submissionCreateSchema.parse(body);
      return ok(await submitHomework(user, input), 201);
    }
    const studentId = z.object({ studentId: z.string().min(1) }).parse(body).studentId;
    const input = quizAttemptSchema.parse(body);
    return ok(await submitQuizAttempt(user, input, studentId));
  } catch (e) {
    return handleError(e);
  }
}
