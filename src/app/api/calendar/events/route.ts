import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { can } from "@/lib/core/permissions";
import { withTenant } from "@/lib/core/tenant-context";
import { createEventSchema } from "@/lib/validations/calendar";
import {
  getOccurrences,
  createEvent,
  inviteAudience,
  getCalendarPrefs,
} from "@/lib/services/calendar.service";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD (A.17.1/2/3). */
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("calendar.view");
    const url = new URL(req.url);
    const { from, to } = rangeSchema.parse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    const prefs = await getCalendarPrefs(user.tenantId);
    const occurrences = await withTenant(user.tenantId, () =>
      getOccurrences({
        from,
        to,
        viewerRole: user.role,
        seeAll: can(user.role, "calendar.manage"),
        showReligious: prefs.showReligiousHolidays,
      })
    );
    return ok({ occurrences, showReligiousHolidays: prefs.showReligiousHolidays });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/calendar/events — create an event (+ optional invites, A.17.5). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("calendar.manage");
    const input = createEventSchema.parse(await req.json().catch(() => ({})));
    const event = await withTenant(user.tenantId, () => createEvent(input, user.id));

    let invited = 0;
    if (input.notify) {
      const r = await inviteAudience(user.tenantId, event, user.id);
      invited = r.invited;
    }

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "calendar.event.create",
        entityType: "CalendarEvent",
        entityId: event.id,
        metadata: JSON.stringify({ title: input.title, date: input.date, invited }),
      },
    });
    return ok({ id: event.id, invited }, 201);
  } catch (err) {
    return handleError(err);
  }
}
