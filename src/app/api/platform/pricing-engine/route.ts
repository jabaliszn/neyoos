/**
 * Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06).
 * The real, live-editable NEYO Ops pricing-engine configuration.
 * GET  — SUPER_ADMIN only (this is a company-only control, unlike the
 *        platform shell-version default, since pricing is far more
 *        sensitive than a UI preference).
 * POST — SUPER_ADMIN only, real audit-logged.
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getPricingEngineConfig, savePricingEngineConfig } from "@/lib/services/pricing-engine.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("SUPER_ADMIN");
    void user;
    return ok(await getPricingEngineConfig());
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const body = await req.json().catch(() => ({}));
    return ok(await savePricingEngineConfig(body, user));
  } catch (e) {
    return handleError(e);
  }
}
