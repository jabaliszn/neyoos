import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { classVoiceActionSchema } from "@/lib/validations/class-voice";
import {
  activeClassVoiceRoom,
  endClassVoiceRoom,
  joinClassVoiceRoom,
  startClassVoiceRoom,
} from "@/lib/services/class-voice.service";

export const dynamic = "force-dynamic";

/** GET /api/class-voice?conversationId= — current active disappearing room for a class group. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const conversationId = req.nextUrl.searchParams.get("conversationId") ?? "";
    return ok(await activeClassVoiceRoom(user, conversationId));
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/class-voice
 * Actions:
 * - start: create/reuse a disappearing voice room for a class group conversation
 * - join: join an active disappearing voice room
 * - end: end an active room for everyone (creator/leadership only)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = classVoiceActionSchema.parse(await req.json().catch(() => ({})));

    if (input.action === "start") {
      return ok(await startClassVoiceRoom(user, {
        conversationId: input.conversationId,
        peerId: input.peerId,
      }));
    }

    if (input.action === "join") {
      return ok(await joinClassVoiceRoom(user, {
        roomKey: input.roomKey,
        peerId: input.peerId,
      }));
    }

    return ok(await endClassVoiceRoom(user, { roomKey: input.roomKey }));
  } catch (error) {
    return handleError(error);
  }
}
