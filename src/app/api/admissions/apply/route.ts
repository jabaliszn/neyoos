/**
 * B.2.1 PUBLIC online application. No auth — tenant resolved from the
 * subdomain (A.2 middleware; dev override ?tenant=). Rate-limited per IP.
 */
import { NextRequest } from "next/server";
import { ok, handleError, fail } from "@/lib/api/respond";
import { applySchema } from "@/lib/validations/admission";
import { submitApplication } from "@/lib/services/admission.service";
import { resolveTenantSlug } from "@/lib/core/subdomain";
import { getTenantBySlug } from "@/lib/services/tenant.service";
import { enforceRate, clientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    enforceRate(`admission-apply:${clientIp(req)}`, 10, 60 * 60); // 10/hour/IP
    const slug = resolveTenantSlug({
      host: req.headers.get("host"),
      searchTenant: req.nextUrl.searchParams.get("tenant"),
      headerTenant: req.headers.get("x-neyo-tenant"),
    });
    if (!slug) return fail("NO_SCHOOL", "Open this page on your school's NEYO address (e.g. karibu-high.neyo.co.ke).", 400);
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return fail("NO_SCHOOL", "School not found.", 404);

    const input = applySchema.parse(await req.json());
    const result = await submitApplication(tenant.id, input, "online");
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
