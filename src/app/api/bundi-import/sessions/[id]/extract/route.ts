import { NextRequest } from "next/server";
import { requirePermission, requireUser } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { extractSession, extractIntelligentSession, getImportSession, BundiImportError } from "@/lib/services/bundi-import.service";
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
 * POST /api/bundi-import/sessions/:id/extract — run (or re-run) extraction,
 * automatically routed to the session's own real pipeline:
 *   - BUNDI_INTELLIGENT: local OCR + rules + (cheap) AI-escalation-if-needed,
 *     open to every school, no code required.
 *   - LEGACY_PROVIDER: the original whole-page vision-model call, still
 *     honestly refused with NOT_CONFIGURED if no real provider is wired.
 * Never fabricates rows either way.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Only a signed-in user is required to LOOK UP which domain this
    // session belongs to (real row-scoping via withTenant already prevents
    // cross-tenant access); the real domain-specific permission is enforced
    // right after, once the session reveals its true domain.
    const user = await requireUser();
    const existing = await getImportSession(user, params.id);
    await requirePermission(permissionForDomain(existing.domain as BundiDomain));

    const session = existing.pipeline === "LEGACY_PROVIDER"
      ? await extractSession(user, params.id)
      : await extractIntelligentSession(user, params.id);
    return ok({ session });
  } catch (err) {
    return mapErr(err) ?? handleError(err);
  }
}
