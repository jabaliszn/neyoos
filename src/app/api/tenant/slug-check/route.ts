import { NextRequest } from "next/server";
import { checkSlug, suggestSlug } from "@/lib/services/tenant.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * GET /api/tenant/slug-check?slug=karibu-high[&name=Karibu+High]
 * Returns availability + (if taken/invalid and a name is given) a suggestion.
 */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug") ?? "";
    const name = req.nextUrl.searchParams.get("name") ?? "";

    const result = await checkSlug(slug);
    if (result.ok) {
      return ok({ available: true, slug: result.slug });
    }

    const suggestion = name ? await suggestSlug(name) : undefined;
    return ok({
      available: false,
      reason: result.reason,
      message: result.message,
      ...(suggestion ? { suggestion } : {}),
    });
  } catch (err) {
    return handleError(err);
  }
}
