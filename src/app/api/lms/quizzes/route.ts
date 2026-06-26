/**
 * B.13 Quizzes — teacher side.
 * GET  /api/lms/quizzes                 — my classes' quizzes + attempt stats
 * GET  /api/lms/quizzes?id=             — per-student results for one quiz
 * POST /api/lms/quizzes                 — create (questions w/ correct answers)
 * PUT  /api/lms/quizzes                 {quizId, published} — publish gate
 * Permission: homework.assign (teaching roles).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { quizCreateSchema } from "@/lib/validations/lms";
import { createQuiz, publishQuiz, listQuizzesForTeacher, quizResults } from "@/lib/services/lms.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("homework.assign");
    const id = req.nextUrl.searchParams.get("id");
    if (id) return ok(await quizResults(user, id));
    return ok({ quizzes: await listQuizzesForTeacher(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("homework.assign");
    const input = quizCreateSchema.parse(await req.json().catch(() => ({})));
    const quiz = await createQuiz(user, input);
    return ok({ id: quiz.id }, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission("homework.assign");
    const input = z.object({ quizId: z.string().min(1), published: z.boolean() }).parse(await req.json());
    return ok(await publishQuiz(user, input.quizId, input.published));
  } catch (e) {
    return handleError(e);
  }
}
