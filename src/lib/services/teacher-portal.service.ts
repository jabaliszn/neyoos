/**
 * B.12 Teacher Portal — one service that powers a teacher's working home:
 * their classes (roster), their weekly timetable, homework they assign,
 * notes they upload, and per-class reports.
 *
 * SCOPING RULE (fail-closed, like A.3.8):
 *   a teacher "owns" a class when they are its class teacher OR they appear
 *   on its timetable (they teach a subject there). Everything in this file
 *   is restricted to those classes for TEACHER/CLASS_TEACHER/HOD/DEAN.
 *   Leadership (PRINCIPAL etc.) passes through unrestricted for oversight.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

export class TeacherPortalError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "TeacherPortalError";
  }
}

const TEACHING_ROLES: Role[] = ["TEACHER", "CLASS_TEACHER", "HOD", "DEAN_OF_STUDIES"];

function isTeachingRole(user: SessionUser): boolean {
  return TEACHING_ROLES.includes(user.role as Role);
}

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType, entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

/**
 * The classes this teacher may operate on:
 * class-teacher classes ∪ classes on their timetable. Fail-closed.
 * Returns null for leadership (= no restriction).
 */
export async function teacherClassIds(user: SessionUser): Promise<string[] | null> {
  if (!isTeachingRole(user)) return null; // leadership: unrestricted
  const [own, slots] = await Promise.all([
    tenantDb().schoolClass.findMany({ where: { classTeacherId: user.id }, select: { id: true } }),
    tenantDb().timetableSlot.findMany({ where: { teacherId: user.id }, select: { classId: true } }),
  ]);
  const ids = new Set<string>([...own.map((c) => c.id), ...slots.map((s) => s.classId)]);
  return ids.size ? [...ids] : ["__none__"];
}

async function assertClassAllowed(user: SessionUser, classId: string) {
  const allowed = await teacherClassIds(user);
  if (allowed !== null && !allowed.includes(classId)) {
    throw new TeacherPortalError("FORBIDDEN", "That is not one of your classes.");
  }
  const cls = await tenantDb().schoolClass.findUnique({ where: { id: classId } });
  if (!cls) throw new TeacherPortalError("NOT_FOUND", "Class not found.");
  return cls;
}

const classLabel = (c: { level: string; stream: string | null }) =>
  [c.level, c.stream].filter(Boolean).join(" ");

// ---------------------------------------------------------------------------
// Teacher home — "My Classes" overview
// ---------------------------------------------------------------------------

export async function teacherHome(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const allowed = await teacherClassIds(user);
    const where = allowed === null ? {} : { id: { in: allowed } };
    const classes = await tenantDb().schoolClass.findMany({
      where: { ...where, archived: false },
      include: { students: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } } },
      orderBy: [{ level: "asc" }, { stream: "asc" }],
    });

    // Subjects this teacher teaches per class (from the timetable).
    const slots = await tenantDb().timetableSlot.findMany({
      where: { teacherId: user.id },
      include: { subject: true },
    });
    const subjByClass = new Map<string, Set<string>>();
    for (const s of slots) {
      const set = subjByClass.get(s.classId) ?? new Set<string>();
      if (s.subject) set.add(s.subject.name);
      subjByClass.set(s.classId, set);
    }

    // Today's lessons (Nairobi) from the teacher's timetable.
    const nairobiNow = new Date(Date.now() + 3 * 3600_000);
    const jsDay = nairobiNow.getUTCDay(); // 0=Sun
    const today = jsDay >= 1 && jsDay <= 5 ? jsDay : null;
    const todaySlots = today === null ? [] : slots.filter((s) => s.dayOfWeek === today).sort((a, b) => a.period - b.period);
    const classMap = new Map(classes.map((c) => [c.id, classLabel(c)]));
    const extraClassIds = [...new Set(todaySlots.map((s) => s.classId).filter((id) => !classMap.has(id)))];
    if (extraClassIds.length) {
      const extra = await tenantDb().schoolClass.findMany({ where: { id: { in: extraClassIds } } });
      for (const c of extra) classMap.set(c.id, classLabel(c));
    }

    // Open homework count per class (due today or later).
    const todayStr = nairobiNow.toISOString().slice(0, 10);
    const openHw = await tenantDb().homework.findMany({
      where: { teacherId: user.id, dueDate: { gte: todayStr } },
      select: { classId: true },
    });
    const hwByClass = new Map<string, number>();
    for (const h of openHw) hwByClass.set(h.classId, (hwByClass.get(h.classId) ?? 0) + 1);

    return {
      classes: classes.map((c) => ({
        id: c.id,
        label: classLabel(c),
        curriculum: c.curriculum,
        isClassTeacher: c.classTeacherId === user.id,
        students: c.students.length,
        subjects: [...(subjByClass.get(c.id) ?? [])],
        openHomework: hwByClass.get(c.id) ?? 0,
      })),
      todayLessons: todaySlots.map((s) => ({
        period: s.period,
        subjectName: s.subject?.name ?? null,
        subjectCode: s.subject?.code ?? null,
        className: classMap.get(s.classId) ?? "—",
        classId: s.classId,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Homework (B.12.6 — unblocks B.10 "View homework" + B.11 "View assignments")
// ---------------------------------------------------------------------------

export async function listHomework(user: SessionUser, q: { classId?: string } = {}) {
  return withTenant(user.tenantId, async () => {
    const allowed = await teacherClassIds(user);
    const where: Record<string, unknown> = {};
    if (q.classId) {
      if (allowed !== null && !allowed.includes(q.classId))
        throw new TeacherPortalError("FORBIDDEN", "That is not one of your classes.");
      where.classId = q.classId;
    } else if (allowed !== null) {
      where.classId = { in: allowed };
    }
    const rows = await tenantDb().homework.findMany({
      where, include: { subject: true },
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }], take: 100,
    });
    const classIds = [...new Set(rows.map((r) => r.classId))];
    const classes = classIds.length ? await tenantDb().schoolClass.findMany({ where: { id: { in: classIds } } }) : [];
    const cMap = new Map(classes.map((c) => [c.id, classLabel(c)]));
    return rows.map((r) => ({
      id: r.id, classId: r.classId, className: cMap.get(r.classId) ?? "—",
      subjectName: r.subject.name, subjectCode: r.subject.code,
      teacherName: r.teacherName, title: r.title, instructions: r.instructions,
      dueDate: r.dueDate, fileUrl: r.fileUrl, fileName: r.fileName,
      createdAt: r.createdAt, mine: r.teacherId === user.id,
    }));
  });
}

export async function createHomework(
  user: SessionUser,
  input: { classId: string; subjectId: string; title: string; instructions?: string; dueDate: string; fileUrl?: string; fileName?: string }
) {
  return withTenant(user.tenantId, async () => {
    const cls = await assertClassAllowed(user, input.classId);
    const subject = await tenantDb().subject.findUnique({ where: { id: input.subjectId } });
    if (!subject) throw new TeacherPortalError("NOT_FOUND", "Subject not found.");

    const todayStr = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    if (input.dueDate < todayStr)
      throw new TeacherPortalError("INVALID", "Due date cannot be in the past.");

    const row = await db.homework.create({
      data: {
        tenantId: user.tenantId, classId: input.classId, subjectId: input.subjectId,
        teacherId: user.id, teacherName: user.fullName,
        title: input.title, instructions: input.instructions ?? null,
        dueDate: input.dueDate, fileUrl: input.fileUrl ?? null, fileName: input.fileName ?? null,
      },
    });
    await audit(user, "homework.assigned", "homework", row.id, {
      class: classLabel(cls), subject: subject.name, title: input.title, dueDate: input.dueDate,
    });
    return row;
  });
}

export async function deleteHomework(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().homework.findUnique({ where: { id } });
    if (!row) throw new TeacherPortalError("NOT_FOUND", "Homework not found.");
    // Only the teacher who set it (or leadership) may remove it.
    if (isTeachingRole(user) && row.teacherId !== user.id)
      throw new TeacherPortalError("FORBIDDEN", "Only the teacher who assigned this homework can remove it.");
    await tenantDb().homework.delete({ where: { id } });
    await audit(user, "homework.removed", "homework", id, { title: row.title });
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Class notes (B.12.5 — unblocks B.11 "Download notes"; B.13 LMS reuses this)
// ---------------------------------------------------------------------------

export async function listNotes(user: SessionUser, q: { classId?: string } = {}) {
  return withTenant(user.tenantId, async () => {
    const allowed = await teacherClassIds(user);
    const where: Record<string, unknown> = {};
    if (q.classId) {
      if (allowed !== null && !allowed.includes(q.classId))
        throw new TeacherPortalError("FORBIDDEN", "That is not one of your classes.");
      where.classId = q.classId;
    } else if (allowed !== null) {
      where.classId = { in: allowed };
    }
    const rows = await tenantDb().classNote.findMany({
      where, include: { subject: true }, orderBy: { createdAt: "desc" }, take: 100,
    });
    const classIds = [...new Set(rows.map((r) => r.classId))];
    const classes = classIds.length ? await tenantDb().schoolClass.findMany({ where: { id: { in: classIds } } }) : [];
    const cMap = new Map(classes.map((c) => [c.id, classLabel(c)]));
    return rows.map((r) => ({
      id: r.id, classId: r.classId, className: cMap.get(r.classId) ?? "—",
      subjectName: r.subject.name, subjectCode: r.subject.code,
      teacherName: r.teacherName, title: r.title, description: r.description,
      fileUrl: r.fileUrl, fileName: r.fileName, createdAt: r.createdAt, mine: r.teacherId === user.id,
    }));
  });
}

export async function createNote(
  user: SessionUser,
  input: { classId: string; subjectId: string; title: string; description?: string; fileUrl: string; fileName: string }
) {
  return withTenant(user.tenantId, async () => {
    const cls = await assertClassAllowed(user, input.classId);
    const subject = await tenantDb().subject.findUnique({ where: { id: input.subjectId } });
    if (!subject) throw new TeacherPortalError("NOT_FOUND", "Subject not found.");
    const row = await db.classNote.create({
      data: {
        tenantId: user.tenantId, classId: input.classId, subjectId: input.subjectId,
        teacherId: user.id, teacherName: user.fullName,
        title: input.title, description: input.description ?? null,
        fileUrl: input.fileUrl, fileName: input.fileName,
      },
    });
    await audit(user, "note.uploaded", "classNote", row.id, {
      class: classLabel(cls), subject: subject.name, title: input.title,
    });
    return row;
  });
}

export async function deleteNote(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().classNote.findUnique({ where: { id } });
    if (!row) throw new TeacherPortalError("NOT_FOUND", "Notes not found.");
    if (isTeachingRole(user) && row.teacherId !== user.id)
      throw new TeacherPortalError("FORBIDDEN", "Only the teacher who uploaded these notes can remove them.");
    await tenantDb().classNote.delete({ where: { id } });
    await audit(user, "note.removed", "classNote", id, { title: row.title });
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Per-class report (B.12.8) — roster + attendance + latest exam in one view
// ---------------------------------------------------------------------------

export async function classReport(user: SessionUser, classId: string) {
  return withTenant(user.tenantId, async () => {
    const cls = await assertClassAllowed(user, classId);

    const students = await tenantDb().student.findMany({
      where: { classId, status: "ACTIVE", deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true, gender: true },
    });
    const ids = students.map((s) => s.id);

    // Attendance, last 30 days.
    const since = new Date(Date.now() + 3 * 3600_000 - 30 * 24 * 3600_000).toISOString().slice(0, 10);
    const att = ids.length
      ? await tenantDb().attendanceRecord.findMany({
          where: { studentId: { in: ids }, date: { gte: since } },
          select: { studentId: true, status: true },
        })
      : [];
    const attByStudent = new Map<string, { present: number; total: number; absences: number }>();
    for (const a of att) {
      const rec = attByStudent.get(a.studentId) ?? { present: 0, total: 0, absences: 0 };
      rec.total++;
      if (a.status === "P" || a.status === "L") rec.present++;
      if (a.status === "A") rec.absences++;
      attByStudent.set(a.studentId, rec);
    }
    const classTotal = att.length;
    const classPresent = att.filter((a) => a.status === "P" || a.status === "L").length;

    // Latest exam with results for this class (published or not — teachers see their own class).
    const latestResult = ids.length
      ? await tenantDb().examResult.findFirst({
          where: { studentId: { in: ids } },
          orderBy: { updatedAt: "desc" },
          include: { exam: true },
        })
      : null;
    let exam: { id: string; name: string; published: boolean; maxMarks: number } | null = null;
    let examRows: { studentId: string; avgPct: number }[] = [];
    if (latestResult) {
      exam = { id: latestResult.exam.id, name: latestResult.exam.name, published: latestResult.exam.published, maxMarks: latestResult.exam.maxMarks };
      const results = await tenantDb().examResult.findMany({
        where: { examId: latestResult.examId, studentId: { in: ids } },
      });
      const byStudent = new Map<string, { total: number; n: number }>();
      for (const r of results) {
        const rec = byStudent.get(r.studentId) ?? { total: 0, n: 0 };
        rec.total += r.marks; rec.n++;
        byStudent.set(r.studentId, rec);
      }
      examRows = [...byStudent.entries()].map(([studentId, v]) => ({
        studentId, avgPct: Math.round((v.total / (v.n * latestResult.exam.maxMarks)) * 100),
      }));
    }
    const examByStudent = new Map(examRows.map((r) => [r.studentId, r.avgPct]));
    const examMean = examRows.length ? Math.round(examRows.reduce((a, r) => a + r.avgPct, 0) / examRows.length) : null;

    return {
      class: { id: cls.id, label: classLabel(cls), curriculum: cls.curriculum, isClassTeacher: cls.classTeacherId === user.id },
      summary: {
        students: students.length,
        boys: students.filter((s) => s.gender === "M").length,
        girls: students.filter((s) => s.gender === "F").length,
        attendancePct30d: classTotal ? Math.round((classPresent / classTotal) * 100) : null,
        latestExam: exam ? { name: exam.name, published: exam.published, meanPct: examMean } : null,
      },
      students: students.map((s) => {
        const a = attByStudent.get(s.id);
        return {
          id: s.id,
          name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
          admissionNo: s.admissionNo,
          gender: s.gender,
          attendancePct: a && a.total ? Math.round((a.present / a.total) * 100) : null,
          absences30d: a?.absences ?? 0,
          examAvgPct: examByStudent.get(s.id) ?? null,
        };
      }),
    };
  });
}
