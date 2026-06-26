import { authenticateApiRequest } from "@/lib/api/bearer";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me — Public API smoke endpoint (A.16).
 * Authenticated with `Authorization: Bearer neyo_sk_…`. Returns the key's
 * tenant identity + a couple of real, tenant-scoped counts so integrators can
 * confirm their credentials and isolation work.
 *
 * Requires scope: reports.view (or "*").
 */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req, "reports.view");
  if (!auth.ok) return auth.response;

  const tenant = await db.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { id: true, name: true, slug: true, county: true, curriculum: true },
  });

  const counts = await withTenant(auth.tenantId, async () => {
    const tdb = tenantDb();
    const [users, payments] = await Promise.all([
      tdb.user.count(),
      tdb.payment.count(),
    ]);
    return { users, payments };
  });

  return Response.json({
    ok: true,
    data: {
      tenant,
      scopes: auth.scopes,
      counts,
      serverTime: new Date().toISOString(),
    },
  });
}
