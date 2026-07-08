/**
 * Part X — Developer Center 2.0 (founder-requested 2026-07-06).
 * A school's OWN, self-scoped real API-usage view — Settings → Developer.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getTenantApiUsage } from "@/lib/services/developer-center.service";
import { apiUsageQuerySchema } from "@/lib/validations/developer-center";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("api.manage");
    const url = new URL(req.url);
    const { days } = apiUsageQuerySchema.parse({ days: url.searchParams.get("days") ?? undefined });
    return ok(await getTenantApiUsage(user.tenantId, days));
  } catch (e) {
    return handleError(e);
  }
}
