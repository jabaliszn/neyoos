import { currentSubdomainTenant } from "@/lib/core/current-tenant";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/tenant/current — the tenant resolved from the subdomain, or null. */
export async function GET() {
  try {
    const tenant = await currentSubdomainTenant();
    if (!tenant) return ok({ tenant: null });
    return ok({
      tenant: { name: tenant.name, slug: tenant.slug, county: tenant.county },
    });
  } catch (err) {
    return handleError(err);
  }
}
