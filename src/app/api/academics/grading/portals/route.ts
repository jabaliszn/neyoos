import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { tenantDb } from "@/lib/core/tenant-db";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const portals = await tenantDb().marksPortal.findMany({
      orderBy: { createdAt: "desc" }
    });
    return ok({ data: portals });
  } catch (error) {
    return handleError(error);
  }
}
