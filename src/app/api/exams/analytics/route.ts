import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { examAnalytics } from "@/lib/services/exam-analytics.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("exam.view");
    return ok(await examAnalytics(user));
  } catch (error) {
    return handleError(error);
  }
}
