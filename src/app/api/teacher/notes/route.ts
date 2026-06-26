/**
 * B.12 Class notes API.
 * GET    /api/teacher/notes?classId=   — list (teacher-scoped)
 * POST   /api/teacher/notes            — share uploaded notes with a class
 * DELETE /api/teacher/notes?id=        — remove own notes
 * Permission: homework.assign (same teaching roles).
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { noteCreateSchema } from "@/lib/validations/teacher-portal";
import { listNotes, createNote, deleteNote } from "@/lib/services/teacher-portal.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("homework.assign");
    const classId = req.nextUrl.searchParams.get("classId") ?? undefined;
    return ok({ notes: await listNotes(user, { classId }) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("homework.assign");
    const input = noteCreateSchema.parse(await req.json().catch(() => ({})));
    const row = await createNote(user, input);
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
    return ok(await deleteNote(user, id));
  } catch (e) {
    return handleError(e);
  }
}
