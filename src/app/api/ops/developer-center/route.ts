/**
 * Part X — Developer Center 2.0 (founder-requested 2026-07-06).
 * NEYO Ops — SUPER_ADMIN only. Real, live API-usage monitoring: total
 * requests, active integrations, failed calls, slow endpoints, top
 * developers, usage by school, and security alerts — every figure
 * computed from real `ApiUsageLog` rows, never a mock.
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  getDeveloperCenterConfig,
  saveDeveloperCenterConfig,
  getApiUsageDashboard,
} from "@/lib/services/developer-center.service";
import { apiUsageQuerySchema } from "@/lib/validations/developer-center";
import { listPartnerApiKeys } from "@/lib/services/api-key.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN");
    const url = new URL(req.url);
    const { days } = apiUsageQuerySchema.parse({ days: url.searchParams.get("days") ?? undefined });
    const [config, dashboard, partnerKeys] = await Promise.all([
      getDeveloperCenterConfig(),
      getApiUsageDashboard(days),
      listPartnerApiKeys(),
    ]);
    return ok({ config, dashboard, partnerKeys });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const body = await req.json().catch(() => ({}));
    return ok(await saveDeveloperCenterConfig(body, user));
  } catch (e) {
    return handleError(e);
  }
}
