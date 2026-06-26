/**
 * B.3 Attendance — service (Chunk 3).
 * Real DB writes; idempotent per (student, day) so re-marking just updates.
 * Row-scoped: teachers mark/see ONLY their own classes (A.3.8), parents see
 * only their own children (A.3.9) — reuses scopeWhere from B.1.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { scopeWhere, StudentError } from "@/lib/services/student.service";
import { checkSmsQuota, recordUsage } from "@/lib/services/limits.service";
import { sendSms } from "@/lib/notifications/sms";
import type { SessionUser } from "@/lib/core/session";
import type { AttendanceStatus, MarkRegisterInput } from "@/lib/validations/attendance";

export class AttendanceError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "QUOTA", message: string) {
    super(message);
    this.name = "AttendanceError";
  }
}

/** Today's date string in Nairobi (UTC+3). */
export function nairobiToday(now = new Date()): string {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * H.2 Master roles — the only roles allowed to invoke the Master Attendance
 * Override (take over ANY class register as the school master). Server-verified;
 * never trust the client checkbox alone.
 */
const MASTER_ROLES = ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"] as const;
function isMasterRole(user: SessionUser): boolean {
  return (
    (MASTER_ROLES as readonly string[]).includes(user.role) ||
    (!!user.secondaryRole && (MASTER_ROLES as readonly string[]).includes(user.secondaryRole))
  );
}

async function classById(classId: string) {
  const cls = await tenantDb().schoolClass.findUnique({ where: { id: classId } });
  if (!cls) throw new AttendanceError("NOT_FOUND", "Class not found.");
  return cls;
}

/** Read scope: leadership can view all; teachers view own class registers only. */
async function assertCanViewClass(user: SessionUser, classId: string) {
  const cls = await classById(classId);
  const teacherLike = ["TEACHER", "CLASS_TEACHER"].includes(user.role) || user.secondaryRole === "TEACHER" || user.secondaryRole === "CLASS_TEACHER";
  if (teacherLike && cls.classTeacherId !== user.id && !isMasterRole(user)) {
    throw new AttendanceError("FORBIDDEN", "You can only view attendance for your own class.");
  }
  return cls;
}

/** Marking without master override: teachers mark own class; Principal/Owner must either own the class or turn on Master Override. */
async function assertCanMarkWithoutOverride(user: SessionUser, classId: string) {
  const cls = await classById(classId);
  const isOwnClassTeacher = cls.classTeacherId === user.id;
  if (isMasterRole(user) && !isOwnClassTeacher) {
    throw new AttendanceError("FORBIDDEN", "Open Master Override before marking a class you do not personally teach.");
  }
  const teacherLike = ["TEACHER", "CLASS_TEACHER"].includes(user.role) || user.secondaryRole === "TEACHER" || user.secondaryRole === "CLASS_TEACHER";
  if (teacherLike && !isOwnClassTeacher) {
    throw new AttendanceError("FORBIDDEN", "You can only mark attendance for your own class.");
  }
  return cls;
}

/** The register for a class+date: every active student + their mark (if any). */
export async function getRegister(user: SessionUser, classId: string, date: string) {
  return withTenant(user.tenantId, async () => {
    const cls = await assertCanViewClass(user, classId);
    const students = await tenantDb().student.findMany({
      where: { classId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true, photoUrl: true, gender: true },
    });
    const marks = await tenantDb().attendanceRecord.findMany({
      where: { classId, date },
      select: { studentId: true, status: true, note: true, markedByName: true, updatedAt: true },
    });
    const markMap = new Map(marks.map((m) => [m.studentId, m]));
    return {
      class: { id: cls.id, label: [cls.level, cls.stream].filter(Boolean).join(" ") },
      date,
      students: students.map((s) => ({
        id: s.id,
        name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
        admissionNo: s.admissionNo,
        photoUrl: s.photoUrl,
        gender: s.gender,
        status: (markMap.get(s.id)?.status as AttendanceStatus | undefined) ?? null,
        note: markMap.get(s.id)?.note ?? null,
      })),
      markedCount: marks.length,
      markedByName: marks[0]?.markedByName ?? null,
    };
  });
}

/** Mark/re-mark a register (idempotent upsert per student+day). */
export async function markRegister(user: SessionUser, input: MarkRegisterInput) {
  return withTenant(user.tenantId, async () => {
    // H.2 Master Attendance Override — server-verified, not client-trusted.
    // A class teacher cannot set masterOverride to escape scope; only true
    // master roles may take over a class that isn't their own.
    const usingMasterOverride = input.masterOverride === true;
    if (usingMasterOverride && !isMasterRole(user)) {
      throw new AttendanceError(
        "FORBIDDEN",
        "Only the Principal or School Owner can take over a register as the school master."
      );
    }
    // Masters skip the per-teacher scope check (they may mark any class);
    // everyone else is still scoped to their own class.
    if (!usingMasterOverride) {
      await assertCanMarkWithoutOverride(user, input.classId);
    } else {
      await classById(input.classId);
    }

    // Only students actually in this class can be marked (defense in depth).
    const classStudents = await tenantDb().student.findMany({
      where: { classId: input.classId, status: "ACTIVE" },
      select: { id: true },
    });
    const allowed = new Set(classStudents.map((s) => s.id));
    const marks = input.marks.filter((m) => allowed.has(m.studentId));
    if (marks.length === 0) throw new AttendanceError("NOT_FOUND", "No matching students in this class.");

    for (const m of marks) {
      await db.attendanceRecord.upsert({
        where: { tenantId_studentId_date: { tenantId: user.tenantId, studentId: m.studentId, date: input.date } },
        create: {
          tenantId: user.tenantId,
          studentId: m.studentId,
          classId: input.classId,
          date: input.date,
          status: m.status,
          note: m.note || null,
          markedById: user.id,
          markedByName: user.fullName,
        },
        update: {
          status: m.status,
          note: m.note || null,
          classId: input.classId,
          markedById: user.id,
          markedByName: user.fullName,
        },
      });
    }

    const counts = { P: 0, A: 0, L: 0, E: 0 } as Record<AttendanceStatus, number>;
    for (const m of marks) counts[m.status]++;

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: usingMasterOverride ? "attendance.master_override" : "attendance.marked",
        entityType: "schoolClass",
        entityId: input.classId,
        metadata: JSON.stringify({
          date: input.date,
          ...counts,
          total: marks.length,
          masterOverride: usingMasterOverride,
        }),
      },
    });

    // Absentee auto-SMS (B.3.4) — opt-in per submission, quota-checked, deduped.
    let sms: { sent: number; skipped: number; message?: string } = { sent: 0, skipped: 0 };
    if (input.notifyAbsent) {
      sms = await notifyAbsentees(user, input.classId, input.date);
    }

    return { saved: marks.length, counts, sms };
  });
}

/** SMS guardians of today's absentees (deduped via smsSentAt; quota-checked). */
async function notifyAbsentees(user: SessionUser, classId: string, date: string) {
  const absents = await tenantDb().attendanceRecord.findMany({
    where: { classId, date, status: "A", smsSentAt: null },
    select: { id: true, studentId: true },
  });
  if (absents.length === 0) return { sent: 0, skipped: 0 };

  const quota = await checkSmsQuota(user.tenantId, absents.length);
  if (!quota.allowed) return { sent: 0, skipped: absents.length, message: quota.message };

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true } });
  let sent = 0;
  let skipped = 0;

  for (const a of absents) {
    const link = await tenantDb().studentGuardian.findFirst({
      where: { studentId: a.studentId, isPrimary: true },
      include: { guardian: true, student: { select: { firstName: true, lastName: true } } },
    }) ?? await tenantDb().studentGuardian.findFirst({
      where: { studentId: a.studentId },
      include: { guardian: true, student: { select: { firstName: true, lastName: true } } },
    });
    if (!link?.guardian.phone) { skipped++; continue; }

    const msg = `${tenant.name}: ${link.student.firstName} ${link.student.lastName} was marked ABSENT today (${date}). If this is unexpected, please contact the school.`;
    try {
      await sendSms(link.guardian.phone, msg);
      await db.attendanceRecord.update({ where: { id: a.id }, data: { smsSentAt: new Date() } });
      sent++;
    } catch {
      skipped++;
    }
  }
  if (sent > 0) {
    await recordUsage(user.tenantId, "smsPerTerm", sent);
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "attendance.absent_sms",
        entityType: "schoolClass",
        entityId: classId,
        metadata: JSON.stringify({ date, sent, skipped }),
      },
    });
  }
  return { sent, skipped };
}

/** History — per student or per class, date-ranged, row-scoped. */
export async function attendanceHistory(
  user: SessionUser,
  q: { studentId?: string; classId?: string; from?: string; to?: string }
) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    if (q.studentId) {
      // verify the student is visible to this user (parent/teacher scoping)
      const s = await tenantDb().student.findFirst({ where: { AND: [{ id: q.studentId }, scope] } });
      if (!s) throw new StudentError("NOT_FOUND", "Student not found.");
    }
    const where: Record<string, unknown> = {};
    if (q.studentId) where.studentId = q.studentId;
    if (q.classId) where.classId = q.classId;
    if (q.from || q.to) where.date = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
    // Scope rows through the visible-students set when no explicit student.
    if (!q.studentId) {
      const visible = await tenantDb().student.findMany({ where: scope, select: { id: true } });
      where.studentId = { in: visible.map((v) => v.id) };
    }

    const rows = await tenantDb().attendanceRecord.findMany({
      where,
      orderBy: [{ date: "desc" }],
      take: 400,
      include: { student: { select: { firstName: true, middleName: true, lastName: true, admissionNo: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      status: r.status,
      note: r.note,
      studentId: r.studentId,
      studentName: [r.student.firstName, r.student.middleName, r.student.lastName].filter(Boolean).join(" "),
      admissionNo: r.student.admissionNo,
      markedByName: r.markedByName,
    }));
  });
}

/** Summary for the attendance index: today's per-class marking state. */
export async function attendanceOverview(user: SessionUser, date: string) {
  return withTenant(user.tenantId, async () => {
    const role = user.role;
    const classWhere: Record<string, unknown> = { archived: false };
    const teacherLike = role === "TEACHER" || role === "CLASS_TEACHER" || user.secondaryRole === "TEACHER" || user.secondaryRole === "CLASS_TEACHER";
    if (teacherLike && !isMasterRole(user)) classWhere.classTeacherId = user.id;

    const classes = await tenantDb().schoolClass.findMany({
      where: classWhere,
      orderBy: [{ level: "asc" }, { stream: "asc" }],
    });
    const result = [];
    for (const c of classes) {
      const total = await tenantDb().student.count({ where: { classId: c.id, status: "ACTIVE" } });
      const marks = await tenantDb().attendanceRecord.groupBy({
        by: ["status"],
        where: { classId: c.id, date },
        _count: { _all: true },
      });
      const counts: Record<string, number> = { P: 0, A: 0, L: 0, E: 0 };
      for (const m of marks) counts[m.status] = m._count._all;
      const marked = counts.P + counts.A + counts.L + counts.E;
      result.push({
        id: c.id,
        label: [c.level, c.stream].filter(Boolean).join(" "),
        total,
        classTeacherId: c.classTeacherId,
        marked,
        present: counts.P + counts.L, // late still in school
        absent: counts.A,
        done: total > 0 && marked >= total,
      });
    }
    return { date, classes: result };
  });
}
