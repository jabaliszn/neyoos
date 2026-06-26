/**
 * B.14 / I.10 Communication API.
 * GET  /api/comms — audience options, send history, teacher approval requests
 * POST /api/comms — bulk send preview/send OR teacher approval request/decision
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { bulkSendSchema, teacherCommsDecisionSchema, teacherCommsRequestSchema } from "@/lib/validations/comms";
import {
  bulkSend,
  audienceOptions,
  listBulkMessages,
  listTeacherMessageApprovals,
  requestTeacherMessageApproval,
  decideTeacherMessageApproval,
} from "@/lib/services/comms.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("comms.send");
    const [audiences, history, approvals] = await Promise.all([
      audienceOptions(user),
      listBulkMessages(user),
      listTeacherMessageApprovals(user),
    ]);
    return ok({ audiences, history, approvals });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("comms.send");
    const body = await req.json().catch(() => ({}));

    if (body.action === "request_teacher_approval") {
      const input = teacherCommsRequestSchema.parse(body);
      return ok(await requestTeacherMessageApproval(user, input));
    }

    if (body.action === "approve_teacher_message" || body.action === "reject_teacher_message") {
      const input = teacherCommsDecisionSchema.parse(body);
      return ok(await decideTeacherMessageApproval(user, input));
    }

    const input = bulkSendSchema.parse(body);
    return ok(await bulkSend(user, input));
  } catch (e) {
    return handleError(e);
  }
}
