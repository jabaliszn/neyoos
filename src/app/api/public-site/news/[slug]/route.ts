import { NextRequest } from "next/server";
import { publicNewsPostBySlug } from "@/lib/services/public-site.service";
import { ok, handleError, fail } from "@/lib/api/respond";
import { resolveTenantSlug } from "@/lib/core/subdomain";
import { newsSlugSchema } from "@/lib/validations/public-site";

export const dynamic = "force-dynamic";

/**
 * GET /api/public-site/news/:slug?tenant=karibu-high
 * Public-safe single-news payload. Drafts never leak.
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const url = new URL(req.url);
    const tenantSlug = resolveTenantSlug({
      host: req.headers.get("host"),
      searchTenant: url.searchParams.get("tenant"),
      headerTenant: req.headers.get("x-neyo-tenant"),
    });
    if (!tenantSlug) return fail("TENANT_REQUIRED", "Choose a school website to view.", 422);

    const postSlug = newsSlugSchema.parse(params.slug);
    const data = await publicNewsPostBySlug(tenantSlug, postSlug);
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
