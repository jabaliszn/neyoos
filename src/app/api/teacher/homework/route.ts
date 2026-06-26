/**
 * B.12 Homework API.
 * GET    /api/teacher/homework?classId=   — list (teacher-scoped)
 * POST   /api/teacher/homework            — assign homework to a class
 * DELETE /api/teacher/homework?id=        — remove own homework
 * Permission: homework.assign.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { homeworkCreateSchema } from "@/lib/validations/teacher-portal";
import { listHomework, createHomework, deleteHomework } from "@/lib/services/teacher-portal.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("homework.assign");
    const classId = req.nextUrl.searchParams.get("classId") ?? undefined;
    return ok({ homework: await listHomework(user, { classId }) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("homework.assign");
    const input = homeworkCreateSchema.parse(await req.json().catch(() => ({})));
    const row = await createHomework(user, input);
    return ok({ id: row.id }, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission("homework.assign");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("MISSING", "id required.", 400);
    return ok(await deleteHomework(user, id));
  } catch (e) {
    return handleError(e);
  }
}
