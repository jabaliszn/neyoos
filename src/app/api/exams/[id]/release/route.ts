/**
 * I.2 Exam release approval workflow.
 * POST actions:
 * - request: HOD/academics requests Principal/Owner approval
 * - approve: Principal/Owner approves and releases results to parents
 * - reject: Principal/Owner returns the request with a note
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { requestExamRelease, decideExamRelease } from "@/lib/services/exam.service";

export const dynamic = "force-dynamic";

const releaseActionSchema = z.object({
  action: z.enum(["request", "approve", "reject"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("exam.view");
    const input = releaseActionSchema.parse(await req.json());
    if (input.action === "request") {
      return ok(await requestExamRelease(user, params.id, input.note || undefined));
    }
    return ok(await decideExamRelease(user, params.id, input.action === "approve" ? "APPROVED" : "REJECTED", input.note || undefined));
  } catch (e) {
    return handleError(e);
  }
}
