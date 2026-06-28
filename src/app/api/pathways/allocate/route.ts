import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { studentPathwayAllocationSchema } from "@/lib/validations/pathways";
import { allocateStudentToPathway } from "@/lib/services/pathway.service";

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const body = await req.json();
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required");
    
    const data = studentPathwayAllocationSchema.parse(body);
    const pref = await allocateStudentToPathway(user, studentId, data);
    return ok({ data: pref }, 201);
  } catch (error) {
    return handleError(error);
  }
}
