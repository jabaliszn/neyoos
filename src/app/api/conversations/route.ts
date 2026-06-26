import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { createConversationSchema } from "@/lib/validations/messaging";
import {
  listConversations,
  createConversation,
} from "@/lib/services/messaging.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/conversations — the current user's conversations. */
export async function GET() {
  try {
    const user = await requireUser();
    const items = await listConversations(user.tenantId, user.id);
    return ok({ conversations: items });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/conversations — start a conversation. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = createConversationSchema.parse(await req.json().catch(() => ({})));
    const convo = await createConversation(
      user.tenantId,
      { id: user.id, fullName: user.fullName, role: user.role, secondaryRole: user.secondaryRole },
      input
    );
    return ok({ id: convo.id });
  } catch (err) {
    return handleError(err);
  }
}
