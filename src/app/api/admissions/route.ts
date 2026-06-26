/**
 * B.2 staff pipeline.
 * GET  /api/admissions            -> all applications (board data)
 * POST /api/admissions            -> staff walk-in application {…applySchema}
 * POST /api/admissions?inquiry=ID -> convert an A.18 inquiry
 * Permission: student.create.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { applySchema } from "@/lib/validations/admission";
import { pipeline, submitApplication, convertInquiry } from "@/lib/services/admission.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("student.create");
    return ok({ applications: await pipeline(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.create");
    const inquiryId = req.nextUrl.searchParams.get("inquiry");
    if (inquiryId) return ok(await convertInquiry(user, inquiryId));
    const input = applySchema.parse(await req.json());
    return ok(await submitApplication(user.tenantId, input, "walk_in"));
  } catch (e) {
    return handleError(e);
  }
}
