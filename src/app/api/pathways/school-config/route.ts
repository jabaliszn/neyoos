import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { requireRevenueFeature } from "@/lib/services/tier-gating.service";
import { ok, fail, handleError } from "@/lib/api/respond";
import { pathwaySchoolConfigSchema } from "@/lib/validations/pathways";
import { getPathwaySchoolConfig, setPathwaySchoolConfig, PathwayError } from "@/lib/services/pathway.service";

/**
 * P.1 — school-wide Senior School pathway configuration (Triple/Dual +
 * which official KICD groups are offered). This is Tenant-level data, not a
 * Pathway row, so it lives on its own route rather than overloading
 * /api/pathways (which lists/creates individual Pathway rows).
 */
export async function GET() {
  try {
    const user = await requirePermission("academics.view");
    await requireRevenueFeature(user, "pathway_guidance");
    const config = await getPathwaySchoolConfig(user);
    return ok(config);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    await requireRevenueFeature(user, "pathway_guidance");
    const body = await req.json();
    const data = pathwaySchoolConfigSchema.parse(body);
    const config = await setPathwaySchoolConfig(user, data);
    return ok(config);
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
