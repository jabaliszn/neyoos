import { NextRequest } from "next/server";
import { requirePermission, requireUser } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getImportSession, cancelSession, BundiImportError } from "@/lib/services/bundi-import.service";
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

/** GET /api/bundi-import/sessions/:id — poll session status/extraction result. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const session = await getImportSession(user, params.id);
    await requirePermission(permissionForDomain(session.domain as BundiDomain));
    return ok({ session });
  } catch (err) {
    return mapErr(err) ?? handleError(err);
  }
}

/** DELETE /api/bundi-import/sessions/:id — cancel a not-yet-committed session. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const session = await getImportSession(user, params.id);
    await requirePermission(permissionForDomain(session.domain as BundiDomain));
    const result = await cancelSession(user, params.id);
    return ok(result);
  } catch (err) {
    return mapErr(err) ?? handleError(err);
  }
}
