import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { verifyActionAssertion } from "@/lib/services/passkey.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ response: z.any(), actionKey: z.string().trim().max(200).optional() });

/**
 * POST /api/auth/passkey/action/verify — verifies the current user's passkey
 * for one critical action. R.3 — when `actionKey` is provided, also mints a
 * real, short-lived, single-use ticket the protected server route (e.g.
 * recording a cash payment) must present and consume — real server-side
 * enforcement, not just a client-trusted popup.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { response, actionKey } = schema.parse(await req.json().catch(() => ({})));
    const result = await verifyActionAssertion(user.id, response, req.nextUrl.origin, actionKey);
    return ok({ verified: true, ticket: result.ticket ?? null });
  } catch (err) {
    return handleError(err);
  }
}
