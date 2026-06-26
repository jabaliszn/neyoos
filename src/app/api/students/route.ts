import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { createStudentSchema, studentFilterSchema } from "@/lib/validations/student";
import { listStudents, createStudent, studentStats } from "@/lib/services/student.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/students — list (row-scoped) with filters + stats (B.1.7/8). */
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("student.view");
    const url = new URL(req.url);
    const filters = studentFilterSchema.parse({
      q: url.searchParams.get("q") || undefined,
      classId: url.searchParams.get("classId") || undefined,
      stream: url.searchParams.get("stream") || undefined,
      status: url.searchParams.get("status") || undefined,
      gender: url.searchParams.get("gender") || undefined,
    });
    const [students, stats] = await Promise.all([
      listStudents(user, filters),
      studentStats(user),
    ]);
    return ok({ students, stats });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/students — register a student (B.1.1). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.create");
    const input = createStudentSchema.parse(await req.json().catch(() => ({})));
    const result = await createStudent(user, input);
    return ok(result, 201);
  } catch (err) {
    return handleError(err);
  }
}
