import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { requireRevenueFeature } from "@/lib/services/tier-gating.service";
import { ok, fail, handleError } from "@/lib/api/respond";
import { seedOfficialPathwaysSchema } from "@/lib/validations/pathways";
import { seedOfficialPathways, PathwayError } from "@/lib/services/pathway.service";

/**
 * P.1 — "Load official KICD pathways" action. An explicit, school-triggered
 * action (never automatic) that creates/matches real Subject rows and real
 * Pathway rows (one per official track) for the requested pathway group(s).
 * Idempotent: safe to call again for the same groups (updates in place).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    await requireRevenueFeature(user, "pathway_guidance");
    const body = await req.json();
    const { groups } = seedOfficialPathwaysSchema.parse(body);
    const result = await seedOfficialPathways(user, groups);
    return ok(result);
  } catch (error) {
    if (error instanceof PathwayError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CONFLICT: 409 };
      return fail(error.code, error.message, statusMap[error.code] as any);
    }
    if ((error as any).name === "ZodError") {
      return fail("INVALID", (error as any).errors[0].message, 400);
    }
    return handleError(error);
  }
}
