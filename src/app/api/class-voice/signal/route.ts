import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  pollClassVoiceSignalsSchema,
  postClassVoiceSignalSchema,
} from "@/lib/validations/class-voice";
import {
  pollClassVoiceSignals,
  postClassVoiceSignal,
} from "@/lib/services/class-voice.service";

export const dynamic = "force-dynamic";

/** GET /api/class-voice/signal?roomKey=&peerId=&sinceId= — poll short-lived signals. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = pollClassVoiceSignalsSchema.parse({
      roomKey: req.nextUrl.searchParams.get("roomKey"),
      peerId: req.nextUrl.searchParams.get("peerId"),
      sinceId: req.nextUrl.searchParams.get("sinceId"),
    });
    return ok(await pollClassVoiceSignals(user, input));
  } catch (error) {
    return handleError(error);
  }
}

/** POST /api/class-voice/signal — post a WebRTC signalling row (offer/answer/ice/control). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = postClassVoiceSignalSchema.parse(await req.json().catch(() => ({})));
    return ok(await postClassVoiceSignal(user, input));
  } catch (error) {
    return handleError(error);
  }
}
