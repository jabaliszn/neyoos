/**
 * Part V — Capacity-Based Pricing 2.0 (founder-confirmed 2026-07-06,
 * "migrate everyone now"). NEYO Ops — SUPER_ADMIN only. Triggers the real,
 * one-time company-wide migration of every existing school onto
 * SIZE_BASED_V2, priced from their real current counts.
 */
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { migrateAllTenantsToSizeBasedPricing } from "@/lib/services/pricing-engine.service";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireRole("SUPER_ADMIN");
    return ok(await migrateAllTenantsToSizeBasedPricing());
  } catch (e) {
    return handleError(e);
  }
}
