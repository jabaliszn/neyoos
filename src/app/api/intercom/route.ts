import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { decideIntercomCall, intercomBoard, startIntercomCall } from "@/lib/services/intercom.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), targetId: z.string().min(1) }),
  z.object({ action: z.enum(["accept", "decline", "end"]), callId: z.string().min(1) }),
]);

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await intercomBoard(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = schema.parse(await req.json().catch(() => ({})));
    if (input.action === "start") return ok(await startIntercomCall(user, input.targetId));
    return ok(await decideIntercomCall(user, input.callId, input.action));
  } catch (err) {
    return handleError(err);
  }
}
