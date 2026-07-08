import { NextRequest } from "next/server";
import { requirePermission, requireUser } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getImportSession, commitSession, BundiImportError } from "@/lib/services/bundi-import.service";
import { commitBundiSessionSchema } from "@/lib/validations/bundi-import";
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

/**
 * POST /api/bundi-import/sessions/:id/commit — write the reviewed rows
 * through the SAME real standard import engine for the session's domain
 * (Student/Staff/Library) — never a second, weaker write path.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const existing = await getImportSession(user, params.id);
    await requirePermission(permissionForDomain(existing.domain as BundiDomain));
    const input = commitBundiSessionSchema.parse(await req.json().catch(() => ({})));
    const result = await commitSession(user, params.id, input);
    return ok(result);
  } catch (err) {
    return mapErr(err) ?? handleError(err);
  }
}
