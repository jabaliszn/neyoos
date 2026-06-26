import { NextRequest } from "next/server";
import { publicSiteBySlug } from "@/lib/services/public-site.service";
import { ok, handleError, fail } from "@/lib/api/respond";
import { resolveTenantSlug } from "@/lib/core/subdomain";

export const dynamic = "force-dynamic";

/**
 * GET /api/public-site/public?tenant=karibu-high
 * Public-safe landing payload. No login required; only published rows returned.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const slug = resolveTenantSlug({
      host: req.headers.get("host"),
      searchTenant: url.searchParams.get("tenant"),
      headerTenant: req.headers.get("x-neyo-tenant"),
    });
    if (!slug) return fail("TENANT_REQUIRED", "Choose a school website to view.", 422);

    const site = await publicSiteBySlug(slug);
    return ok({ site });
  } catch (err) {
    return handleError(err);
  }
}
