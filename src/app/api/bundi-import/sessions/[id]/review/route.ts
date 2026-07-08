import { NextRequest } from "next/server";
import { requirePermission, requireUser } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getImportSession, reviewSession, BundiImportError } from "@/lib/services/bundi-import.service";
import { reviewImportSessionSchema } from "@/lib/validations/bundi-import";
import type { BundiDomain } from "@/lib/validations/bundi-intelligent";

export const dynamic = "force-dynamic";

function permissionForDomain(domain: BundiDomain) {
  if (domain === "STAFF") return "staff.manage" as const;
  if (domain === "LIBRARY") return "library.manage" as const;
  return "student.create" as const;
}

function mapErr(e: unknown) {
  if (e instanceof BundiImportError) {
    const m = { NOT_FOUND: 404, INVALID: 400, FORBIDDEN: 403, NOT_CONFIGURED: 409, EXPIRED: 410, EXHAUSTED: 410, STATE: 409 } as const;
    return fail(e.code, e.message, m[e.code]);
  }
  return null;
}

/** POST /api/bundi-import/sessions/:id/review — save the school's row edits.
 * Every genuine correction is also fed into the Bundi Intelligent learned-
 * corrections engine, so it's remembered for free on future sessions. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const existing = await getImportSession(user, params.id);
    await requirePermission(permissionForDomain(existing.domain as BundiDomain));
    const input = reviewImportSessionSchema.parse(await req.json().catch(() => ({})));
    const session = await reviewSession(user, params.id, input);
    return ok({ session });
  } catch (err) {
    return mapErr(err) ?? handleError(err);
  }
}
