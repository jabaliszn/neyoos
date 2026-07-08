/**
 * R.8 — GET/POST the school's own sibling-discount % (Tenant.siblingDiscountPct).
 * GET: any signed-in staff with finance visibility can see the current %.
 * POST: only leadership (tenant.manage_settings) may change it.
 * Replaces the old platform-wide flat-10% `enable_sibling_discount` switch,
 * which is fully retired — each school now controls its own number here.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getSiblingDiscountSetting, setSiblingDiscountSetting } from "@/lib/services/family.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("finance.view");
    return ok(await getSiblingDiscountSetting(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("tenant.manage_settings");
    const { pct } = z.object({ pct: z.coerce.number().int().min(0).max(100) }).parse(await req.json().catch(() => ({})));
    return ok(await setSiblingDiscountSetting(user, pct));
  } catch (err) {
    return handleError(err);
  }
}
