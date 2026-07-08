import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { triggerTermComputation, releaseTermResults, getMasterReportCards, ComputationError } from "@/lib/services/computation-engine.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const termId = req.nextUrl.searchParams.get("termId");
    const classId = req.nextUrl.searchParams.get("classId");
    if (!termId || !classId) return fail("INVALID", "termId and classId are required.", 400);
    const data = await getMasterReportCards(user.tenantId, termId, classId);
    return ok(data);
  } catch (error) {
    if (error instanceof ComputationError) return fail("INVALID", error.message, 400);
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const body = await req.json();
    
    if (body.action === "COMPUTE") {
      const res = await triggerTermComputation(user.tenantId, body.portalId);
      return ok(res, 202); // 202 Accepted (Background processing)
    }
    
    if (body.action === "RELEASE") {
      // Must be high level leadership
      if (!["PRINCIPAL", "DEPUTY_PRINCIPAL", "SUPER_ADMIN"].includes(user.role)) {
        return fail("FORBIDDEN", "Only Principal or Deputy can release results.", 403);
      }
      const res = await releaseTermResults(user.tenantId, body.portalId, user.id);
      return ok(res);
    }

    return fail("INVALID", "Unknown action", 400);
  } catch (error) {
    if (error instanceof ComputationError) return fail("INVALID", error.message, 400);
    return handleError(error);
  }
}
