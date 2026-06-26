import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { verifyActionAssertion } from "@/lib/services/passkey.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ response: z.any() });

/** POST /api/auth/passkey/action/verify — verifies the current user's passkey for one critical action. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { response } = schema.parse(await req.json().catch(() => ({})));
    await verifyActionAssertion(user.id, response, req.nextUrl.origin);
    return ok({ verified: true });
  } catch (err) {
    return handleError(err);
  }
}
