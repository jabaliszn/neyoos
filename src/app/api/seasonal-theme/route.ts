import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { currentSeasonalTheme } from "@/lib/services/seasonal-theme.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await currentSeasonalTheme(user));
  } catch (e) {
    return handleError(e);
  }
}
