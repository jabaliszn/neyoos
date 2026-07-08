/**
 * R.6 — one School Activity's full real roster + participant actions.
 * GET  — the real roster (every student, real status, real balance).
 * POST {action:"pay", participantId, ...} — record a real payment
 *      (finance.record_payment) — inherits the R.3 biometric gate.
 * POST {action:"waive", participantId, reason} — record "going, pay later"
 *      (finance.manage_structure) — creates a REAL open balance from here.
 * POST {action:"unwaive", participantId} — undo an in-error waiver, only
 *      while genuinely unpaid (finance.manage_structure).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { activityRoster, recordActivityPayment, waiveActivityParticipant, unwaiveActivityParticipant } from "@/lib/services/school-activity.service";
import { recordActivityPaymentSchema, waiveActivityParticipantSchema, unwaiveActivityParticipantSchema } from "@/lib/validations/school-activity";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("finance.view");
    return ok(await activityRoster(user, params.id));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = z.enum(["pay", "waive", "unwaive"]).parse(body?.action);

    if (action === "pay") {
      const user = await requirePermission("finance.record_payment");
      const input = recordActivityPaymentSchema.parse(body);
      return ok(await recordActivityPayment(user, input));
    }

    if (action === "waive") {
      const user = await requirePermission("finance.manage_structure");
      const input = waiveActivityParticipantSchema.parse(body);
      return ok(await waiveActivityParticipant(user, input.participantId, input.reason));
    }

    const user = await requirePermission("finance.manage_structure");
    const input = unwaiveActivityParticipantSchema.parse(body);
    return ok(await unwaiveActivityParticipant(user, input.participantId));
  } catch (e) {
    return handleError(e);
  }
}
