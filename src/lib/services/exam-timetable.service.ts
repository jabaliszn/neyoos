import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class ExamTimetableError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "CONFLICT", message: string) {
    super(message);
    this.name = "ExamTimetableError";
  }
}

function classLabel(c: { level: string; stream: string | null }) { return [c.level, c.stream].filter(Boolean).join(" "); }

export async function examTimetableBoard(user: SessionUser, q: { classId?: string } = {}) {
  return withTenant(user.tenantId, async () => {
    const classes = await tenantDb().schoolClass.findMany({ where: { archived: false }, orderBy: [{ level: "asc" }, { stream: "asc" }] });
    const subjects = await tenantDb().subject.findMany({ where: { archived: false }, orderBy: { name: "asc" } });
    const rows = await tenantDb().examTimetableSlot.findMany({
      where: q.classId ? { classId: q.classId } : {},
      orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
      take: 200,
    });
    const cMap = new Map(classes.map((c) => [c.id, classLabel(c)]));
    const sMap = new Map(subjects.map((s) => [s.id, `${s.name} (${s.code})`]));
    return {
      classes: classes.map((c) => ({ id: c.id, name: classLabel(c) })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      slots: rows.map((r) => ({ ...r, className: cMap.get(r.classId) ?? "—", subjectName: sMap.get(r.subjectId) ?? "—" })),
    };
  });
}

export async function createExamTimetableSlot(user: SessionUser, input: { classId: string; subjectId: string; examName: string; examDate: string; startTime: string; endTime: string; venue?: string; notes?: string }) {
  return withTenant(user.tenantId, async () => {
    const cls = await tenantDb().schoolClass.findUnique({ where: { id: input.classId } });
    if (!cls) throw new ExamTimetableError("NOT_FOUND", "Class not found.");
    const subject = await tenantDb().subject.findUnique({ where: { id: input.subjectId } });
    if (!subject) throw new ExamTimetableError("NOT_FOUND", "Subject not found.");
    const clash = await tenantDb().examTimetableSlot.findFirst({
      where: { classId: input.classId, examDate: input.examDate, OR: [{ startTime: { lt: input.endTime }, endTime: { gt: input.startTime } }] },
    });
    if (clash) throw new ExamTimetableError("CONFLICT", "This class already has an exam in that time window.");
    const row = await tenantDb().examTimetableSlot.create({ data: { ...input, venue: input.venue || null, notes: input.notes || null, createdById: user.id, createdByName: user.fullName } as never });
    await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "exam_timetable.created", entityType: "examTimetableSlot", entityId: row.id, metadata: JSON.stringify({ class: classLabel(cls), subject: subject.name, date: input.examDate }) } });
    return row;
  });
}

export async function deleteExamTimetableSlot(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().examTimetableSlot.findUnique({ where: { id } });
    if (!row) throw new ExamTimetableError("NOT_FOUND", "Exam timetable slot not found.");
    await tenantDb().examTimetableSlot.delete({ where: { id } });
    await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "exam_timetable.deleted", entityType: "examTimetableSlot", entityId: id } });
    return { id };
  });
}
