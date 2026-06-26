/**
 * B.1 Alumni directory.
 * GET  /api/students/alumni?year=2026 -> grouped GRADUATED students.
 * POST /api/students/alumni           -> graduate a whole class {classId, year?}.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { listAlumni, graduateClass } from "@/lib/services/student.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("student.view");
    const yearRaw = req.nextUrl.searchParams.get("year");
    const year = yearRaw ? z.coerce.number().int().min(1990).max(2100).parse(yearRaw) : undefined;
    return ok(await listAlumni(user, year));
  } catch (e) {
    return handleError(e);
  }
}

const graduateSchema = z.object({
  classId: z.string().min(1),
  year: z.coerce.number().int().min(1990).max(2100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.edit");
    const body = graduateSchema.parse(await req.json());
    return ok(await graduateClass(user, body.classId, body.year));
  } catch (e) {
    return handleError(e);
  }
}
