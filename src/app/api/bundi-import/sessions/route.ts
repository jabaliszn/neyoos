import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { startImportSession, startIntelligentSession, listImportSessions, BundiImportError } from "@/lib/services/bundi-import.service";
import { startImportSessionSchema } from "@/lib/validations/bundi-import";
import { BUNDI_DOMAINS, type BundiDomain } from "@/lib/validations/bundi-intelligent";

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

/** GET /api/bundi-import/sessions?domain=STUDENT|STAFF|LIBRARY — this
 * school's recent Bundi import attempts (both pipelines). */
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("domain");
    const domain = raw && (BUNDI_DOMAINS as readonly string[]).includes(raw) ? (raw as BundiDomain) : undefined;
    const user = await requirePermission(domain ? permissionForDomain(domain) : "student.create");
    const sessions = await listImportSessions(user, domain);
    return ok({ sessions });
  } catch (err) {
    return mapErr(err) ?? handleError(err);
  }
}

/**
 * POST /api/bundi-import/sessions — start a new session.
 * `pipeline: "BUNDI_INTELLIGENT"` (default) needs NO unlock code — open to
 * every school. `pipeline: "LEGACY_PROVIDER"` still requires a real
 * NEYO-Ops-issued unlock code (a genuinely costlier whole-page AI path).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const input = startImportSessionSchema.parse(body);
    const user = await requirePermission(permissionForDomain(input.domain));
    const pipeline = body.pipeline === "LEGACY_PROVIDER" ? "LEGACY_PROVIDER" : "BUNDI_INTELLIGENT";
    const session = pipeline === "LEGACY_PROVIDER"
      ? await startImportSession(user, input)
      : await startIntelligentSession(user, input);
    return ok({ session }, 201);
  } catch (err) {
    return mapErr(err) ?? handleError(err);
  }
}
