import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { calendarPrefsSchema } from "@/lib/validations/calendar";
import { setCalendarPrefs } from "@/lib/services/calendar.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** PUT /api/calendar/prefs — toggle religious holidays (A.17.3). */
export async function PUT(req: NextRequest) {
  try {
    // Reuse tenant settings permission for the school-wide toggle.
    const user = await requirePermission("tenant.manage_settings");
    const input = calendarPrefsSchema.parse(await req.json().catch(() => ({})));
    const result = await setCalendarPrefs(user.tenantId, input.showReligiousHolidays);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
