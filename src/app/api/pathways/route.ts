import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { requireRevenueFeature } from "@/lib/services/tier-gating.service";
import { ok, fail, handleError } from "@/lib/api/respond";
import { pathwaySchema } from "@/lib/validations/pathways";
import { getPathways, createPathway, PathwayError } from "@/lib/services/pathway.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    await requireRevenueFeature(user, "pathway_guidance");
    const pathways = await getPathways(user);
    return ok(pathways);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    await requireRevenueFeature(user, "pathway_guidance");
    const body = await req.json();
    const data = pathwaySchema.parse(body);
    const pathway = await createPathway(user, data);
    return ok(pathway, 201);
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
