/**
 * B.6 formative assessments. GET sheet ?strandId=&classId= · POST save round.
 * Permission: exam.enter_marks (teachers); row-scoped in the service.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { assessSchema } from "@/lib/validations/cbc";
import { getAssessSheet, saveAssessments } from "@/lib/services/cbc.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("exam.enter_marks");
    const strandId = req.nextUrl.searchParams.get("strandId");
    const classId = req.nextUrl.searchParams.get("classId");
    if (!strandId || !classId) return fail("MISSING", "strandId and classId required.", 400);
    return ok(await getAssessSheet(user, strandId, classId));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("exam.enter_marks");
    const body = assessSchema.extend({ classId: z.string().min(1) }).parse(await req.json());
    return ok(await saveAssessments(user, body, body.classId));
  } catch (e) {
    return handleError(e);
  }
}
