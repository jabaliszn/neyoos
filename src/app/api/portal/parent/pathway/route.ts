import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { parentChildPathwayReadiness } from "@/lib/services/parent-portal.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId required", 400);

    const data = await parentChildPathwayReadiness(user, studentId);
    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}
