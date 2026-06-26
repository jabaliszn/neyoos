import { requireUser } from "@/lib/core/session";
import { getModuleStates } from "@/lib/services/module.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/modules — module states for the signed-in user's school. */
export async function GET() {
  try {
    const user = await requireUser();
    const modules = await getModuleStates(user.tenantId);
    return ok({ modules });
  } catch (err) {
    return handleError(err);
  }
}
