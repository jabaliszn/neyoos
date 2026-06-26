import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { decideOnlineClassQuestion, joinOnlineClassRoom, pollOnlineClassSignals, postOnlineClassSignal, raiseOnlineClassHand, updateOnlineClassControls } from "@/lib/services/online-class.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const user = await requireUser();
    const peerId = req.nextUrl.searchParams.get("peerId") || "";
    const sinceId = req.nextUrl.searchParams.get("sinceId");
    return ok(await pollOnlineClassSignals(user, params.roomId, peerId, sinceId));
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const action = z.enum(["join", "signal", "controls", "question", "questionDecision"]).parse(body.action);
    if (action === "join") {
      const input = z.object({ peerId: z.string().min(3), role: z.enum(["TEACHER", "STUDENT", "TV"]).optional() }).parse(body);
      return ok(await joinOnlineClassRoom(user, params.roomId, input));
    }
    if (action === "controls") {
      const input = z.object({ fromPeerId: z.string(), muteAllStudents: z.boolean().optional(), studentVideoDisabled: z.boolean().optional(), screenSharePeerId: z.string().nullable().optional(), recordingAllowed: z.boolean().optional() }).parse(body);
      return ok(await updateOnlineClassControls(user, params.roomId, input));
    }
    if (action === "question") {
      const input = z.object({ peerId: z.string(), question: z.string().trim().min(1).max(500) }).parse(body);
      return ok(await raiseOnlineClassHand(user, params.roomId, input));
    }
    if (action === "questionDecision") {
      const input = z.object({ fromPeerId: z.string(), questionId: z.string(), status: z.enum(["APPROVED", "DISMISSED"]) }).parse(body);
      return ok(await decideOnlineClassQuestion(user, params.roomId, input));
    }
    const input = z.object({ fromPeerId: z.string(), toPeerId: z.string().optional().nullable(), type: z.enum(["offer", "answer", "ice", "join", "leave", "control", "screen-share"]), payload: z.unknown().optional() }).parse(body);
    return ok(await postOnlineClassSignal(user, params.roomId, { ...input, payload: input.payload ?? {} }));
  } catch (e) { return handleError(e); }
}
