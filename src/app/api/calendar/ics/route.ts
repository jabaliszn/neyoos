import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { can } from "@/lib/core/permissions";
import { withTenant } from "@/lib/core/tenant-context";
import {
  getOccurrences,
  buildIcs,
  getCalendarPrefs,
} from "@/lib/services/calendar.service";
import { db } from "@/lib/db";
import { handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/ics — download the school calendar as an .ics file (A.17.4).
 * Exports a 13-month window (last month + next 12) so most planning is covered.
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await requirePermission("calendar.view");

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 12, 0);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

    const prefs = await getCalendarPrefs(user.tenantId);
    const occurrences = await withTenant(user.tenantId, () =>
      getOccurrences({
        from: iso(start),
        to: iso(end),
        viewerRole: user.role,
        seeAll: can(user.role, "calendar.manage"),
        showReligious: prefs.showReligiousHolidays,
      })
    );

    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { name: true, slug: true },
    });
    const ics = buildIcs(occurrences, tenant.name);

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${tenant.slug}-calendar.ics"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
