import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getAnonymousEducationTrends } from "@/lib/services/ecosystem-trends.service";

export async function GET(req: NextRequest) {
  try {
    // Only SUPER_ADMIN has 'founder.ops' permission implicitly, or we check directly.
    // Let's use the founder ops permission
    const user = await requirePermission("platform.founder_ops"); 
    const data = await getAnonymousEducationTrends(user);
    return ok({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("FORBIDDEN")) {
      return fail("FORBIDDEN", error.message, 403);
    }
    return handleError(error);
  }
}
