import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { updateEventSchema } from "@/lib/validations/calendar";
import { updateEvent, deleteEvent } from "@/lib/services/calendar.service";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** PATCH /api/calendar/events/:id — edit an event (A.17.1). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission("calendar.manage");
    const input = updateEventSchema.parse(await req.json().catch(() => ({})));
    const updated = await withTenant(user.tenantId, () => updateEvent(params.id, input));
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "calendar.event.update",
        entityType: "CalendarEvent",
        entityId: params.id,
      },
    });
    return ok({ id: updated.id });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/calendar/events/:id — remove an event (A.17.1). */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission("calendar.manage");
    const result = await withTenant(user.tenantId, () => deleteEvent(params.id));
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "calendar.event.delete",
        entityType: "CalendarEvent",
        entityId: params.id,
      },
    });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
