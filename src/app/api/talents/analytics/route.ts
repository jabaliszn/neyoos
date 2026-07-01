import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getTalentParticipationAnalytics } from "@/lib/services/talent.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const termId = req.nextUrl.searchParams.get("termId");
    const analytics = await getTalentParticipationAnalytics(user, { termId: termId || null });
    return ok({ data: analytics });
  } catch (error) {
    return handleError(error);
  }
}
