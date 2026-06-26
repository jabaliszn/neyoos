import { requireUser } from "@/lib/core/session";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * I.84 — Offline Saved-Data / Bundle-Saver snapshot.
 * Read-only, signed-in, tenant-scoped data for this app only. The browser stores
 * it in IndexedDB after the user opts in; no external bundle/data product is used.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const tenantId = user.tenantId;
    const [tenant, classes, students, invoices, calendarEvents, timetableSlots, notifications] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true, county: true } }),
      db.schoolClass.findMany({ where: { tenantId, archived: false }, select: { id: true, level: true, stream: true, curriculum: true }, orderBy: [{ level: "asc" }, { stream: "asc" }] }),
      db.student.findMany({ where: { tenantId, status: "ACTIVE", deletedAt: null }, select: { id: true, admissionNo: true, legacyAdmissionNo: true, firstName: true, middleName: true, lastName: true, classId: true, status: true }, orderBy: [{ firstName: "asc" }], take: 500 }),
      db.invoice.findMany({ where: { tenantId, status: { in: ["UNPAID", "PARTIAL"] } }, select: { id: true, invoiceNo: true, studentId: true, description: true, totalKes: true, paidKes: true, discountKes: true, dueDate: true, status: true }, orderBy: { dueDate: "asc" }, take: 500 }),
      db.calendarEvent.findMany({ where: { tenantId }, select: { id: true, title: true, date: true, endDate: true, startTime: true, endTime: true, type: true, location: true }, orderBy: { date: "asc" }, take: 150 }),
      db.timetableSlot.findMany({ where: { tenantId }, include: { subject: { select: { name: true, code: true } } }, take: 500 }),
      db.notification.findMany({ where: { tenantId, recipientId: user.id }, select: { id: true, title: true, body: true, category: true, href: true, readAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 80 }),
    ]);
    const classMap = new Map(classes.map((c) => [c.id, [c.level, c.stream].filter(Boolean).join(" ")]));
    return ok({
      version: 1,
      savedForUserId: user.id,
      generatedAt: new Date().toISOString(),
      tenant,
      classes: classes.map((c) => ({ ...c, name: [c.level, c.stream].filter(Boolean).join(" ") })),
      students: students.map((s) => ({ ...s, name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "), className: s.classId ? classMap.get(s.classId) ?? "—" : "—" })),
      invoices: invoices.map((i) => ({ ...i, balanceKes: i.totalKes - i.discountKes - i.paidKes })),
      calendarEvents,
      timetableSlots: timetableSlots.map((s) => ({ id: s.id, classId: s.classId, className: classMap.get(s.classId) ?? "—", dayOfWeek: s.dayOfWeek, period: s.period, subjectName: s.subject.name, subjectCode: s.subject.code, teacherId: s.teacherId, venue: s.venue })),
      notifications: notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, category: n.category, href: n.href, read: Boolean(n.readAt), createdAt: n.createdAt.toISOString() })),
    });
  } catch (e) {
    return handleError(e);
  }
}
