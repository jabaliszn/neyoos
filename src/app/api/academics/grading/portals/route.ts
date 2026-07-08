import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const portals = await withTenant(user.tenantId, async () =>
      tenantDb().marksPortal.findMany({ orderBy: { createdAt: "desc" } })
    );
    return ok(portals);
  } catch (error) {
    return handleError(error);
  }
}
