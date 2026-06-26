import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { messageActionSchema, sendMessageSchema } from "@/lib/validations/messaging";
import {
  acknowledgeMessage,
  disappearMessageAttachment,
  getMessages,
  messageDeliveryReport,
  sendMessage,
} from "@/lib/services/messaging.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/conversations/:id/messages — thread (marks read), or ?report=<messageId>. */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const reportMessageId = req.nextUrl.searchParams.get("report");
    if (reportMessageId) {
      return ok(await messageDeliveryReport(user.tenantId, user.id, { conversationId: params.id, messageId: reportMessageId }));
    }
    const data = await getMessages(user.tenantId, user.id, params.id, {
      markRead: true,
    });
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/conversations/:id/messages — send a message. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const input = sendMessageSchema.parse({ ...body, conversationId: params.id });
    const msg = await sendMessage(
      user.tenantId,
      { id: user.id, fullName: user.fullName },
      input
    );
    return ok({ id: msg.id });
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH /api/conversations/:id/messages — acknowledge or wipe disappearing voice note. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const input = messageActionSchema.parse(await req.json().catch(() => ({})));

    if (input.action === "ack") {
      return ok(await acknowledgeMessage(user.tenantId, { id: user.id, fullName: user.fullName }, { conversationId: params.id, messageId: input.messageId }));
    }

    return ok(await disappearMessageAttachment(user.tenantId, user.id, { conversationId: params.id, messageId: input.messageId }));
  } catch (err) {
    return handleError(err);
  }
}
