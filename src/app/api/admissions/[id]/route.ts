/**
 * B.2 pipeline actions on one application.
 * POST /api/admissions/[id] {action, ...} — review/schedule_interview/offer/
 * waitlist/reject/withdraw/record_deposit/admit. Permission: student.create.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { decisionSchema } from "@/lib/validations/admission";
import { decide } from "@/lib/services/admission.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.create");
    const input = decisionSchema.parse(await req.json());
    return ok({ application: await decide(user, params.id, input) });
  } catch (e) {
    return handleError(e);
  }
}
