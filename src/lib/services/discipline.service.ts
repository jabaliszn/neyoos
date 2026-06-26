/**
 * B.20 Discipline — incident reports w/ demerit-point behavior tracking,
 * suspensions (with end-date + return conditions), CONFIDENTIAL counseling
 * notes (counseling.confidential holders ONLY — never parents, never the
 * reporting teachers), and AUTO PARENT SMS on MAJOR/SEVERE incidents and
 * every suspension (quota-checked).
 *
 * Severity → demerit points: MINOR=1, MAJOR=3, SEVERE=5.
 * Behavior status from points (this term): GOOD <3, WATCH 3-7, AT_RISK ≥8.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { scopeWhere } from "@/lib/services/student.service";
import { teacherClassIds } from "@/lib/services/teacher-portal.service";
import { sendSms } from "@/lib/notifications/sms";
import { checkSmsQuota, recordUsage } from "@/lib/services/limits.service";
import { can } from "@/lib/core/permissions";
import type { Role } from "@/lib/core/roles";
import type { SessionUser } from "@/lib/core/session";

export class DisciplineError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "ALREADY", message: string) {
    super(message);
    this.name = "DisciplineError";
  }
}

const SEVERITY_POINTS: Record<string, number> = { MINOR: 1, MAJOR: 3, SEVERE: 5 };
const DISCIPLINE_APPROVER_ROLES = ["PRINCIPAL", "DEPUTY_PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"];
const SUSPENSION_PROPOSER_ROLES = ["HOD", "DEAN_OF_STUDIES"];
function hasRole(user: SessionUser, roles: string[]) {
  return roles.includes(user.role) || (!!user.secondaryRole && roles.includes(user.secondaryRole));
}
function canApproveDiscipline(user: SessionUser) { return hasRole(user, DISCIPLINE_APPROVER_ROLES); }

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType, entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

const fullName = (s: { firstName: string; middleName: string | null; lastName: string }) =>
  [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");

function nairobiToday(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

/** Teachers may only act on students in their classes (B.12 rule); leadership all. */
async function assertStudentInScope(user: SessionUser, studentId: string) {
  const student = await tenantDb().student.findFirst({ where: { id: studentId, deletedAt: null } });
  if (!student) throw new DisciplineError("NOT_FOUND", "Student not found.");
  const role = user.role as Role;
  const teacherLike = ["TEACHER", "CLASS_TEACHER", "HOD", "DEAN_OF_STUDIES"].includes(role) ||
    (!!user.secondaryRole && ["TEACHER", "CLASS_TEACHER", "HOD", "DEAN_OF_STUDIES"].includes(user.secondaryRole));
  if (teacherLike && !canApproveDiscipline(user)) {
    const allowed = await teacherClassIds(user);
    if (allowed !== null && (!student.classId || !allowed.includes(student.classId)))
      throw new DisciplineError("FORBIDDEN", "You can only report incidents for students in your classes.");
  }
  return student;
}

/** Guardian SMS helper (quota-checked, one per primary guardian). */
async function smsGuardian(user: SessionUser, studentId: string, message: string): Promise<boolean> {
  const quota = await checkSmsQuota(user.tenantId, 1);
  if (!quota.allowed) return false;
  const link =
    (await tenantDb().studentGuardian.findFirst({ where: { studentId, isPrimary: true }, include: { guardian: true } })) ??
    (await tenantDb().studentGuardian.findFirst({ where: { studentId }, include: { guardian: true } }));
  if (!link?.guardian.phone) return false;
  try {
    await sendSms(link.guardian.phone, message);
    await recordUsage(user.tenantId, "smsPerTerm", 1);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Incidents (B.20.1) + behavior tracking (B.20.3)
// ---------------------------------------------------------------------------

export async function reportIncident(
  user: SessionUser,
  input: { studentId: string; date: string; category: string; severity: string; description: string; actionTaken?: string; proofFileUrl?: string; proofFileName?: string }
) {
  return withTenant(user.tenantId, async () => {
    const student = await assertStudentInScope(user, input.studentId);
    const points = SEVERITY_POINTS[input.severity] ?? 1;

    const needsApproval = input.severity !== "MINOR" && !canApproveDiscipline(user);
    const incident = await db.disciplineIncident.create({
      data: {
        tenantId: user.tenantId, studentId: student.id,
        studentName: fullName(student), admissionNo: student.admissionNo,
        date: input.date, category: input.category, severity: input.severity, points,
        description: input.description, actionTaken: input.actionTaken ?? null,
        reportedById: user.id, reportedByName: user.fullName,
        status: needsApproval ? "PENDING" : "APPROVED",
        approvedById: needsApproval ? null : user.id,
        approvedByName: needsApproval ? null : user.fullName,
        approvedAt: needsApproval ? null : new Date(),
        proofFileUrl: input.proofFileUrl ?? null,
        proofFileName: input.proofFileName ?? null,
      },
    });

    // AUTO PARENT SMS for APPROVED MAJOR/SEVERE only. HOD/teacher proposals wait for Principal/Deputy approval.
    let parentNotified = false;
    if (input.severity !== "MINOR" && !needsApproval) {
      const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true } });
      parentNotified = await smsGuardian(
        user, student.id,
        `${tenant.name}: a ${input.severity.toLowerCase()} discipline incident (${input.category.toLowerCase()}) involving ${student.firstName} ${student.lastName} was recorded today (${input.date}). Please contact the deputy principal's office.`
      );
      if (parentNotified) {
        await tenantDb().disciplineIncident.update({ where: { id: incident.id }, data: { parentNotifiedAt: new Date() } });
      }
    }

    await audit(user, needsApproval ? "discipline.incident_proposed" : "discipline.incident_reported", "disciplineIncident", incident.id, {
      student: incident.studentName, category: input.category, severity: input.severity, points, parentNotified, status: incident.status,
    });
    return { id: incident.id, points, parentNotified, status: incident.status };
  });
}

export async function listIncidents(user: SessionUser, q: { studentId?: string; search?: string } = {}) {
  return withTenant(user.tenantId, async () => {
    // Teachers see incidents of THEIR classes' students only.
    const role = user.role as Role;
    let studentFilter: Record<string, unknown> = {};
    const teacherLike = ["TEACHER", "CLASS_TEACHER", "HOD", "DEAN_OF_STUDIES"].includes(role) ||
      (!!user.secondaryRole && ["TEACHER", "CLASS_TEACHER", "HOD", "DEAN_OF_STUDIES"].includes(user.secondaryRole));
    if (teacherLike && !canApproveDiscipline(user)) {
      const allowed = await teacherClassIds(user);
      if (allowed !== null) {
        const kids = await tenantDb().student.findMany({ where: { classId: { in: allowed } }, select: { id: true } });
        studentFilter = { studentId: { in: kids.map((k) => k.id) } };
      }
    }
    const search = q.search?.trim();
    return tenantDb().disciplineIncident.findMany({
      where: {
        ...studentFilter,
        ...(q.studentId ? { studentId: q.studentId } : {}),
        ...(search ? {
          OR: [
            { studentName: { contains: search } },
            { admissionNo: { contains: search } },
            { category: { contains: search.toUpperCase() } },
            { description: { contains: search } },
            { proofFileName: { contains: search } },
          ],
        } : {}),
      },
      orderBy: { date: "desc" }, take: 100,
    });
  });
}

/** Behavior board: demerit totals per student (this year) + status bands. */
export async function behaviorBoard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const year = nairobiToday().slice(0, 4);
    const incidents = await tenantDb().disciplineIncident.findMany({ where: { date: { gte: `${year}-01-01` }, status: "APPROVED" } });
    const byStudent = new Map<string, { studentName: string; admissionNo: string; points: number; incidents: number; lastDate: string }>();
    for (const i of incidents) {
      const rec = byStudent.get(i.studentId) ?? { studentName: i.studentName, admissionNo: i.admissionNo, points: 0, incidents: 0, lastDate: i.date };
      rec.points += i.points;
      rec.incidents++;
      if (i.date > rec.lastDate) rec.lastDate = i.date;
      byStudent.set(i.studentId, rec);
    }
    return [...byStudent.entries()]
      .map(([studentId, r]) => ({
        studentId, ...r,
        status: r.points >= 8 ? "AT_RISK" : r.points >= 3 ? "WATCH" : "GOOD",
      }))
      .sort((a, b) => b.points - a.points);
  });
}


export async function approveIncident(user: SessionUser, incidentId: string, approve = true, note?: string) {
  return withTenant(user.tenantId, async () => {
    if (!canApproveDiscipline(user)) {
      throw new DisciplineError("FORBIDDEN", "Only the Principal or Deputy Principal can approve discipline cases.");
    }
    const incident = await tenantDb().disciplineIncident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new DisciplineError("NOT_FOUND", "Incident not found.");
    if (incident.status !== "PENDING") throw new DisciplineError("ALREADY", "This discipline case has already been decided.");
    const row = await db.disciplineIncident.update({
      where: { id: incidentId },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        approvedById: user.id,
        approvedByName: user.fullName,
        approvedAt: new Date(),
        decisionNote: note ?? null,
      },
    });
    let parentNotified = false;
    if (approve && incident.severity !== "MINOR") {
      const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true } });
      const student = await tenantDb().student.findUniqueOrThrow({ where: { id: incident.studentId } });
      parentNotified = await smsGuardian(
        user,
        incident.studentId,
        `${tenant.name}: a ${incident.severity.toLowerCase()} discipline incident (${incident.category.toLowerCase()}) involving ${student.firstName} ${student.lastName} was approved today. Please contact the deputy principal's office.`
      );
      if (parentNotified) await db.disciplineIncident.update({ where: { id: incidentId }, data: { parentNotifiedAt: new Date() } });
    }
    await audit(user, approve ? "discipline.incident_approved" : "discipline.incident_rejected", "disciplineIncident", incidentId, { student: incident.studentName, parentNotified, note });
    return { ...row, parentNotified };
  });
}

// ---------------------------------------------------------------------------
// Suspensions (B.20.2)
// ---------------------------------------------------------------------------

export async function issueSuspension(
  user: SessionUser,
  input: { studentId: string; startDate: string; endDate: string; reason: string; conditions?: string }
) {
  return withTenant(user.tenantId, async () => {
    // HODs/Deans may PROPOSE; Principal/Deputy/Owner approve or issue directly.
    const isLeadership = canApproveDiscipline(user);
    if (!isLeadership && !hasRole(user, SUSPENSION_PROPOSER_ROLES)) {
      throw new DisciplineError("FORBIDDEN", "Only the Principal, Deputy Principal or HOD can issue/propose suspensions.");
    }

    const student = await assertStudentInScope(user, input.studentId);
    if (input.endDate < input.startDate) throw new DisciplineError("INVALID", "End date must be after the start date.");
    
    const existing = await tenantDb().suspension.findFirst({ where: { studentId: student.id, status: { in: ["ACTIVE", "PENDING"] } } });
    if (existing) throw new DisciplineError("ALREADY", "This student already has an active or pending suspension.");

    // Starts as PENDING if issued by an HOD/Dean; starts as ACTIVE if issued directly by Principal/Deputy.
    const status = isLeadership ? "ACTIVE" : "PENDING";

    const susp = await db.suspension.create({
      data: {
        tenantId: user.tenantId, studentId: student.id,
        studentName: fullName(student), admissionNo: student.admissionNo,
        startDate: input.startDate, endDate: input.endDate,
        reason: input.reason, conditions: input.conditions ?? null,
        status,
        issuedById: user.id, issuedByName: user.fullName,
        approvedById: isLeadership ? user.id : null,
        approvedByName: isLeadership ? user.fullName : null,
        approvedAt: isLeadership ? new Date() : null,
      },
    });

    let notified = false;
    if (status === "ACTIVE") {
      // ALWAYS notify the guardian of an active/approved suspension.
      const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true } });
      notified = await smsGuardian(
        user, student.id,
        `${tenant.name}: ${student.firstName} ${student.lastName} has been suspended from ${input.startDate} to ${input.endDate}. ${input.conditions ? `Conditions: ${input.conditions}. ` : ""}Please come to the school office.`
      );
      if (notified) await tenantDb().suspension.update({ where: { id: susp.id }, data: { parentNotifiedAt: new Date() } });
    }

    await audit(user, status === "ACTIVE" ? "discipline.suspension_issued" : "discipline.suspension_proposed", "suspension", susp.id, {
      student: susp.studentName, startDate: input.startDate, endDate: input.endDate, parentNotified: notified,
    });
    
    return { id: susp.id, status, parentNotified: notified };
  });
}

/** Approve a proposed suspension (Principal / Deputy Only) (H.3) */
export async function approveSuspension(user: SessionUser, suspensionId: string) {
  return withTenant(user.tenantId, async () => {
    const isLeadership = canApproveDiscipline(user);
    if (!isLeadership) {
      throw new DisciplineError("FORBIDDEN", "Only the Principal or Deputy Principal has the authority to approve suspensions.");
    }

    const s = await tenantDb().suspension.findUnique({ where: { id: suspensionId } });
    if (!s) throw new DisciplineError("NOT_FOUND", "Suspension not found.");
    if (s.status !== "PENDING") throw new DisciplineError("ALREADY", "This suspension has already been decided.");

    // Update status to ACTIVE
    const updated = await tenantDb().suspension.update({
      where: { id: suspensionId },
      data: { status: "ACTIVE", approvedById: user.id, approvedByName: user.fullName, approvedAt: new Date() },
    });

    // Notify the guardian
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true } });
    const student = await tenantDb().student.findUniqueOrThrow({ where: { id: s.studentId } });
    const notified = await smsGuardian(
      user, s.studentId,
      `${tenant.name}: Suspension approved for ${student.firstName} ${student.lastName} from ${s.startDate} to ${s.endDate}. Please come to the school office.`
    );
    
    if (notified) {
      await tenantDb().suspension.update({ where: { id: suspensionId }, data: { parentNotifiedAt: new Date() } });
    }

    await audit(user, "discipline.suspension_approved", "suspension", suspensionId, {
      student: s.studentName, parentNotified: notified,
    });

    return { id: suspensionId, status: "ACTIVE", parentNotified: notified };
  });
}

export async function listSuspensions(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().suspension.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    const today = nairobiToday();
    return rows.map((s) => ({
      ...s,
      effective: s.status === "ACTIVE" && s.startDate <= today && today <= s.endDate,
    }));
  });
}

export async function completeSuspension(user: SessionUser, suspensionId: string) {
  return withTenant(user.tenantId, async () => {
    if (!canApproveDiscipline(user))
      throw new DisciplineError("FORBIDDEN", "Only the principal or deputy can close suspensions.");
    const s = await tenantDb().suspension.findUnique({ where: { id: suspensionId } });
    if (!s) throw new DisciplineError("NOT_FOUND", "Suspension not found.");
    if (s.status !== "ACTIVE") throw new DisciplineError("ALREADY", "Already closed.");
    const row = await tenantDb().suspension.update({ where: { id: suspensionId }, data: { status: "COMPLETED" } });
    await audit(user, "discipline.suspension_completed", "suspension", suspensionId, { student: s.studentName });
    return row;
  });
}

// ---------------------------------------------------------------------------
// Counseling (B.20.4) — CONFIDENTIAL
// ---------------------------------------------------------------------------

function assertCounselor(user: SessionUser) {
  if (!canApproveDiscipline(user))
    throw new DisciplineError("FORBIDDEN", "Counseling records are confidential.");
}

export async function addCounselingNote(
  user: SessionUser,
  input: { studentId: string; date: string; sessionType: string; note: string; followUpOn?: string }
) {
  return withTenant(user.tenantId, async () => {
    assertCounselor(user);
    const student = await tenantDb().student.findFirst({ where: { id: input.studentId, deletedAt: null } });
    if (!student) throw new DisciplineError("NOT_FOUND", "Student not found.");
    const note = await db.counselingNote.create({
      data: {
        tenantId: user.tenantId, studentId: student.id, studentName: fullName(student),
        date: input.date, sessionType: input.sessionType, note: input.note,
        followUpOn: input.followUpOn ?? null,
        counselorId: user.id, counselorName: user.fullName,
      },
    });
    // Deliberately NO note content in the audit trail (confidentiality).
    await audit(user, "discipline.counseling_added", "counselingNote", note.id, { student: note.studentName, sessionType: input.sessionType });
    return note;
  });
}

export async function listCounselingNotes(user: SessionUser, studentId?: string) {
  return withTenant(user.tenantId, async () => {
    assertCounselor(user);
    return tenantDb().counselingNote.findMany({
      where: studentId ? { studentId } : {},
      orderBy: { date: "desc" }, take: 50,
    });
  });
}

// ---------------------------------------------------------------------------
// Family portal: a child's own discipline summary (NO counseling, ever)
// ---------------------------------------------------------------------------

export async function childDiscipline(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const child = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] } });
    if (!child) throw new DisciplineError("NOT_FOUND", "Student not found.");
    const [incidents, suspensions] = await Promise.all([
      tenantDb().disciplineIncident.findMany({
        where: { studentId },
        orderBy: { date: "desc" }, take: 10,
        select: { id: true, date: true, category: true, severity: true, actionTaken: true }, // no reporter name to families
      }),
      tenantDb().suspension.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" }, take: 5,
        select: { id: true, startDate: true, endDate: true, reason: true, conditions: true, status: true },
      }),
    ]);
    return { incidents, suspensions };
  });
}
