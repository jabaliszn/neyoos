/**
 * H.2 Multi-Owner Support — joint approvals.
 * GET  /api/owner-approvals             -> owners board + pending requests + policy
 * POST /api/owner-approvals {action}    -> setPolicy | request | decide
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  ownersBoard, setJointApproval, requestOwnerApproval, decideOwnerApproval, OWNER_ACTIONS,
} from "@/lib/services/owner-approval.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await ownersBoard(user));
  } catch (e) {
    return handleError(e);
  }
}

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setPolicy"), enabled: z.boolean() }),
  z.object({
    action: z.literal("request"),
    requestAction: z.enum(OWNER_ACTIONS),
    summary: z.string().trim().min(3).max(300),
    payload: z.any().optional(),
  }),
  z.object({ action: z.literal("decide"), requestId: z.string().min(1), approve: z.boolean(), note: z.string().max(300).optional() }),
]);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const b = body.parse(await req.json());
    if (b.action === "setPolicy") return ok(await setJointApproval(user, b.enabled));
    if (b.action === "request") return ok(await requestOwnerApproval(user, { action: b.requestAction, summary: b.summary, payload: b.payload }), 201);
    return ok(await decideOwnerApproval(user, b.requestId, b.approve, b.note));
  } catch (e) {
    return handleError(e);
  }
}
