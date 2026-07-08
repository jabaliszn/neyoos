import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getFieldTemplate, saveFieldTemplate, BundiImportError } from "@/lib/services/bundi-import.service";
import { saveFieldTemplateSchema } from "@/lib/validations/bundi-import";
import { BUNDI_DOMAINS, type BundiDomain } from "@/lib/validations/bundi-intelligent";

export const dynamic = "force-dynamic";

/** N.1 — the real permission each Bundi domain's field template needs,
 * matching that domain's own standard import engine's permission exactly. */
function permissionForDomain(domain: BundiDomain) {
  if (domain === "STAFF") return "staff.manage" as const;
  if (domain === "LIBRARY") return "library.manage" as const;
  return "student.create" as const;
}

function parseDomain(req: NextRequest): BundiDomain {
  const raw = req.nextUrl.searchParams.get("domain") ?? "STUDENT";
  return (BUNDI_DOMAINS as readonly string[]).includes(raw) ? (raw as BundiDomain) : "STUDENT";
}

function mapErr(e: unknown) {
  if (e instanceof BundiImportError) {
    const m = { NOT_FOUND: 404, INVALID: 400, FORBIDDEN: 403, NOT_CONFIGURED: 409, EXPIRED: 410, EXHAUSTED: 410, STATE: 409 } as const;
    return fail(e.code, e.message, m[e.code]);
  }
  return null;
}

/** GET /api/bundi-import/field-template?domain=STUDENT|STAFF|LIBRARY — the
 * school's own saved register-field description for that domain. */
export async function GET(req: NextRequest) {
  try {
    const domain = parseDomain(req);
    const user = await requirePermission(permissionForDomain(domain));
    const result = await getFieldTemplate(user, domain);
    return ok(result);
  } catch (err) {
    return mapErr(err) ?? handleError(err);
  }
}

/** POST /api/bundi-import/field-template — save/update the description (body includes domain). */
export async function POST(req: NextRequest) {
  try {
    const input = saveFieldTemplateSchema.parse(await req.json().catch(() => ({})));
    const user = await requirePermission(permissionForDomain(input.domain));
    const result = await saveFieldTemplate(user, input);
    return ok(result);
  } catch (err) {
    return mapErr(err) ?? handleError(err);
  }
}
