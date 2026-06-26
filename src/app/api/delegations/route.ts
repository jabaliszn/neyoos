import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { delegationActionSchema } from "@/lib/validations/delegation";
import { cancelDelegationTask, completeDelegationTask, createDelegationTask, delegationBoard } from "@/lib/services/delegation.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await delegationBoard(user));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = delegationActionSchema.parse(await req.json().catch(() => ({})));
    if (body.action === "create") return ok(await createDelegationTask(user, body), 201);
    if (body.action === "complete") return ok(await completeDelegationTask(user, body.taskId));
    return ok(await cancelDelegationTask(user, body.taskId));
  } catch (e) {
    return handleError(e);
  }
}
