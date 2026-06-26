import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getScaleReadiness } from "@/lib/services/scale-readiness.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/scale-readiness — SUPER_ADMIN-safe 2M-user readiness checklist. */
export async function GET() {
  try {
    await requireRole("SUPER_ADMIN");
    return ok({ scale: await getScaleReadiness() });
  } catch (error) {
    return handleError(error);
  }
}
