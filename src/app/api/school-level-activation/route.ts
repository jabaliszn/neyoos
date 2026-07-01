import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getSchoolLevelActivationSummary } from "@/lib/services/school-profile.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("tenant.manage_settings");
    return ok({ activation: await getSchoolLevelActivationSummary(user.tenantId) });
  } catch (err) {
    return handleError(err);
  }
}
