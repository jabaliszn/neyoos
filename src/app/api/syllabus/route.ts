import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { syllabusActionSchema } from "@/lib/validations/syllabus";
import { createSyllabusTopic, syllabusBoard, updateSyllabusTopic } from "@/lib/services/syllabus.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const sp = req.nextUrl.searchParams;
    return ok(await syllabusBoard(user, {
      classId: sp.get("classId") || undefined,
      subjectId: sp.get("subjectId") || undefined,
      status: sp.get("status") || undefined,
    }));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const input = syllabusActionSchema.parse(await req.json().catch(() => ({})));
    if (input.action === "create") return ok(await createSyllabusTopic(user, input), 201);
    return ok(await updateSyllabusTopic(user, input));
  } catch (err) {
    return handleError(err);
  }
}
