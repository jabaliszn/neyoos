/**
 * J.23 — Per-school manual feature grants — NEYO Ops (SUPER_ADMIN) only.
 *
 * Founder requirement (2026-06-29): NEYO Ops can grant a premium revenue feature
 * to a specific school for free, regardless of plan.
 *
 * GET  /api/ops/feature-grants
 *        → { features: RevenueFeatureDef[], grants: { [tenantId]: string[] }, schools: [...] }
 * POST /api/ops/feature-grants { tenantId, featureKey, granted, note? }
 *        → grant or revoke one feature for one school.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { REVENUE_FEATURES, REVENUE_FEATURE_KEYS } from "@/lib/core/revenue-features";
import { listAllGrants, setFeatureGrant } from "@/lib/services/feature-grants.service";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("SUPER_ADMIN");
    const [grants, schools] = await Promise.all([
      listAllGrants(),
      db.tenant.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } }),
    ]);
    return ok({ features: REVENUE_FEATURES, grants, schools });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const input = z
      .object({
        tenantId: z.string().min(1),
        featureKey: z.enum(REVENUE_FEATURE_KEYS as [string, ...string[]]),
        granted: z.boolean(),
        note: z.string().trim().max(200).optional(),
      })
      .parse(await req.json().catch(() => ({})));

    const result = await setFeatureGrant(user, input.tenantId, input.featureKey, input.granted, input.note);
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
