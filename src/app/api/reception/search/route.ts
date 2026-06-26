import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { search } from "@/lib/services/search.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * GET /api/reception/search?q= — search anyone (students/parents/phones) (A.18.2).
 * Reuses the tenant-scoped A.11 search; the desk uses it for quick lookups.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("reception.operate");
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const hits = await search(user.tenantId, q, user);
    return ok({ hits });
  } catch (err) {
    return handleError(err);
  }
}
