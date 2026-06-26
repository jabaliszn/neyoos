/**
 * B.9 Human Resources — staff records, leave (balances + approval), contracts,
 * recruitment, appraisals, promotions, disciplinary + training records.
 *
 * WHO: staff.view = read; staff.manage = leadership writes. Any staff member
 * can APPLY for their own leave + see their own record.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { isRole } from "@/lib/core/roles";

export class HrError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "FORBIDDEN" | "BALANCE", message: string) {
    super(message);
    this.name = "HrError";
  }
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

/** KE-typical annual leave allowances (days/year). EDIT POINT per school policy. */
export const LEAVE_TYPES: Record<string, { label: string; daysPerYear: number }> = {
  ANNUAL: { label: "Annual leave", daysPerYear: 30 },
  SICK: { label: "Sick leave", daysPerYear: 14 },
  MATERNITY: { label: "Maternity leave", daysPerYear: 90 },
  PATERNITY: { label: "Paternity leave", daysPerYear: 14 },
  COMPASSIONATE: { label: "Compassionate leave", daysPerYear: 7 },
  STUDY: { label: "Study leave", daysPerYear: 10 },
};

function daysBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
}

// ---------------------------------------------------------------------------
// Staff records + contracts (B.9.1/3)
// ---------------------------------------------------------------------------

export async function staffDirectory(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const staff = await tenantDb().user.findMany({
      where: { isActive: true, role: { notIn: ["PARENT", "STUDENT", "SUPER_ADMIN"] } },
      select: { id: true, fullName: true, role: true, phone: true, email: true },
      orderBy: { fullName: "asc" },
    });
    const profiles = await tenantDb().staffProfile.findMany();
    const pMap = new Map(profiles.map((p) => [p.userId, p]));
    return staff.map((u) => {
      const p = pMap.get(u.id);
      return {
        userId: u.id, name: u.fullName, role: u.role, phone: u.phone, email: u.email,
        tscNumber: p?.tscNumber ?? null, qualifications: p?.qualifications ?? null,
        employmentDate: p?.employmentDate ?? null,
        contractType: p?.contractType ?? null, contractEndDate: p?.contractEndDate ?? null,
        visibilityAreas: p?.visibilityAreas ? JSON.parse(p.visibilityAreas) : [],
        hasProfile: Boolean(p),
      };
    });
  });
}

export async function upsertProfile(user: SessionUser, input: { userId: string; tscNumber?: string; nationalId?: string; kraPin?: string; qualifications?: string; employmentDate?: string; contractType?: string; contractEndDate?: string; emergencyContact?: string; visibilityAreas?: string[] }) {
  return withTenant(user.tenantId, async () => {
    const target = await tenantDb().user.findUnique({ where: { id: input.userId } });
    if (!target) throw new HrError("NOT_FOUND", "Staff member not found.");
    const row = await db.staffProfile.upsert({
      where: { userId: input.userId },
      create: {
        tenantId: user.tenantId, userId: input.userId,
        tscNumber: input.tscNumber || null, nationalId: input.nationalId || null,
        kraPin: input.kraPin || null, qualifications: input.qualifications || null,
        employmentDate: input.employmentDate || null,
        contractType: input.contractType || "PERMANENT",
        contractEndDate: input.contractEndDate || null,
        emergencyContact: input.emergencyContact || null,
        visibilityAreas: input.visibilityAreas ? JSON.stringify(input.visibilityAreas) : null,
      },
      update: {
        tscNumber: input.tscNumber || null, nationalId: input.nationalId || null,
        kraPin: input.kraPin || null, qualifications: input.qualifications || null,
        employmentDate: input.employmentDate || null,
        contractType: input.contractType || "PERMANENT",
        contractEndDate: input.contractEndDate || null,
        emergencyContact: input.emergencyContact || null,
        ...(input.visibilityAreas !== undefined ? { visibilityAreas: JSON.stringify(input.visibilityAreas) } : {}),
      },
    });
    await audit(user, "hr.profile_saved", "staffProfile", row.id, { userId: input.userId });
    return row;
  });
}

/** B.9.6 staff promotion = role change with audit trail. */
export async function promoteStaff(user: SessionUser, targetUserId: string, newRole: string, note?: string) {
  return withTenant(user.tenantId, async () => {
    const allowedRoles = ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"];
    const hasPrimary = allowedRoles.includes(user.role);
    const hasSecondary = user.secondaryRole ? allowedRoles.includes(user.secondaryRole) : false;
    
    if (!hasPrimary && !hasSecondary) {
      throw new HrError("FORBIDDEN", "Only the Principal or School Owner has the authority to promote staff or appoint HODs.");
    }

    const target = await tenantDb().user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new HrError("NOT_FOUND", "Staff member not found.");
    if (!isRole(newRole) || ["PARENT", "STUDENT", "SUPER_ADMIN"].includes(newRole)) throw new HrError("INVALID", "Invalid staff role.");
    if (target.id === user.id) throw new HrError("FORBIDDEN", "You cannot change your own role.");
    const oldRole = target.role;
    await tenantDb().user.update({ where: { id: targetUserId }, data: { role: newRole } });
    await audit(user, "hr.staff_promoted", "user", targetUserId, {
      from: oldRole,
      to: newRole,
      note,
      confirmedById: user.id,
      confirmedByName: user.fullName,
      confirmedByRole: user.role,
      confirmedBySecondaryRole: user.secondaryRole,
    });
    return { userId: targetUserId, from: oldRole, to: newRole, confirmedBy: user.fullName };
  });
}

// ---------------------------------------------------------------------------
// Leave management (B.9.2)
// ---------------------------------------------------------------------------

export async function leaveBalances(user: SessionUser, userId: string) {
  return withTenant(user.tenantId, async () => {
    const year = new Date().getFullYear();
    const taken = await tenantDb().leaveRequest.findMany({
      where: { userId, status: "APPROVED", startDate: { gte: `${year}-01-01` } },
    });
    const used = new Map<string, number>();
    for (const l of taken) used.set(l.type, (used.get(l.type) ?? 0) + l.days);
    return Object.entries(LEAVE_TYPES).map(([type, def]) => ({
      type, label: def.label, allowance: def.daysPerYear,
      used: used.get(type) ?? 0, remaining: def.daysPerYear - (used.get(type) ?? 0),
    }));
  });
}

export async function applyForLeave(user: SessionUser, input: { type: string; startDate: string; endDate: string; reason?: string }) {
  return withTenant(user.tenantId, async () => {
    if (!LEAVE_TYPES[input.type]) throw new HrError("INVALID", "Unknown leave type.");
    if (input.endDate < input.startDate) throw new HrError("INVALID", "End date is before the start date.");
    const days = daysBetween(input.startDate, input.endDate);
    const balances = await leaveBalances(user, user.id);
    const bal = balances.find((b) => b.type === input.type)!;
    if (days > bal.remaining)
      throw new HrError("BALANCE", `Only ${bal.remaining} ${bal.label.toLowerCase()} day${bal.remaining === 1 ? "" : "s"} remaining this year (requested ${days}).`);
    const row = await tenantDb().leaveRequest.create({
      data: {
        userId: user.id, userName: user.fullName, type: input.type,
        startDate: input.startDate, endDate: input.endDate, days,
        reason: input.reason || null,
      } as never,
    });
    await audit(user, "hr.leave_applied", "leaveRequest", row.id, { type: input.type, days });
    return row;
  });
}

export async function decideLeave(user: SessionUser, leaveId: string, approve: boolean, note?: string) {
  return withTenant(user.tenantId, async () => {
    const leave = await tenantDb().leaveRequest.findUnique({ where: { id: leaveId } });
    if (!leave) throw new HrError("NOT_FOUND", "Leave request not found.");
    if (leave.status !== "PENDING") throw new HrError("INVALID", "This request was already decided.");
    if (leave.userId === user.id) throw new HrError("FORBIDDEN", "You cannot approve your own leave.");

    const status = approve ? "APPROVED" : "REJECTED";
    await tenantDb().leaveRequest.update({
      where: { id: leaveId },
      data: { status, decidedById: user.id, decidedByName: user.fullName, decidedAt: new Date(), decisionNote: note || null },
    });

    // Approved leave appears on the shared calendar (A.17 reuse).
    if (approve) {
      const { createEvent } = await import("@/lib/services/calendar.service");
      await createEvent(
        {
          title: `${leave.userName} — ${LEAVE_TYPES[leave.type]?.label ?? leave.type}`,
          date: leave.startDate, endDate: leave.endDate === leave.startDate ? undefined : leave.endDate,
          type: "event", audience: "all", description: "On leave",
        } as never,
        user.id
      ).catch(() => null);
    }
    await audit(user, approve ? "hr.leave_approved" : "hr.leave_rejected", "leaveRequest", leaveId, { days: leave.days, note });
    return { id: leaveId, status };
  });
}

export async function listLeave(user: SessionUser, mineOnly: boolean) {
  return withTenant(user.tenantId, async () => {
    const where = mineOnly ? { userId: user.id } : {};
    return tenantDb().leaveRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  });
}

// ---------------------------------------------------------------------------
// Recruitment (B.9.4)
// ---------------------------------------------------------------------------

export async function listPostings(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().jobPosting.findMany({ orderBy: { createdAt: "desc" }, include: { applications: true } });
    return rows.map((p) => ({
      id: p.id, title: p.title, description: p.description, deadline: p.deadline, open: p.open,
      applicationCount: p.applications.length,
      applications: p.applications.map((a) => ({ id: a.id, name: a.name, phone: a.phone, email: a.email, status: a.status, notes: a.notes })),
    }));
  });
}

export async function createPosting(user: SessionUser, input: { title: string; description?: string; deadline?: string }) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().jobPosting.create({
      data: { title: input.title, description: input.description || null, deadline: input.deadline || null } as never,
    });
    await audit(user, "hr.job_posted", "jobPosting", row.id, { title: input.title });
    return row;
  });
}

export async function addApplication(user: SessionUser, postingId: string, input: { name: string; phone: string; email?: string; notes?: string }) {
  return withTenant(user.tenantId, async () => {
    const posting = await tenantDb().jobPosting.findUnique({ where: { id: postingId } });
    if (!posting) throw new HrError("NOT_FOUND", "Job posting not found.");
    return db.jobApplication.create({
      data: { postingId, name: input.name, phone: input.phone, email: input.email || null, notes: input.notes || null },
    });
  });
}

export async function setApplicationStatus(user: SessionUser, applicationId: string, status: string) {
  return withTenant(user.tenantId, async () => {
    const app = await db.jobApplication.findUnique({ where: { id: applicationId }, include: { posting: true } });
    if (!app || app.posting.tenantId !== user.tenantId) throw new HrError("NOT_FOUND", "Application not found.");
    await db.jobApplication.update({ where: { id: applicationId }, data: { status } });
    await audit(user, "hr.application_status", "jobApplication", applicationId, { status });
    return { id: applicationId, status };
  });
}

// ---------------------------------------------------------------------------
// Appraisals, disciplinary, training (B.9.5/7/8)
// ---------------------------------------------------------------------------

export async function addAppraisal(user: SessionUser, input: { userId: string; period: string; score: number; strengths?: string; improvements?: string }) {
  return withTenant(user.tenantId, async () => {
    const target = await tenantDb().user.findUnique({ where: { id: input.userId } });
    if (!target) throw new HrError("NOT_FOUND", "Staff member not found.");
    const row = await tenantDb().appraisal.create({
      data: {
        userId: input.userId, userName: target.fullName, period: input.period,
        score: input.score, strengths: input.strengths || null, improvements: input.improvements || null,
        reviewerId: user.id, reviewerName: user.fullName,
      } as never,
    });
    await audit(user, "hr.appraisal_added", "appraisal", row.id, { userId: input.userId, score: input.score });
    return row;
  });
}

export async function addDisciplinary(user: SessionUser, input: { userId: string; date: string; category: string; details: string; actionTaken?: string }) {
  return withTenant(user.tenantId, async () => {
    const target = await tenantDb().user.findUnique({ where: { id: input.userId } });
    if (!target) throw new HrError("NOT_FOUND", "Staff member not found.");
    const row = await tenantDb().disciplinaryRecord.create({
      data: {
        userId: input.userId, userName: target.fullName, date: input.date,
        category: input.category, details: input.details, actionTaken: input.actionTaken || null,
        recordedById: user.id, recordedByName: user.fullName,
      } as never,
    });
    await audit(user, "hr.disciplinary_recorded", "disciplinaryRecord", row.id, { userId: input.userId, category: input.category });
    return row;
  });
}

export async function addTraining(user: SessionUser, input: { userId: string; title: string; provider?: string; date: string; durationDays: number; certificateUrl?: string }) {
  return withTenant(user.tenantId, async () => {
    const target = await tenantDb().user.findUnique({ where: { id: input.userId } });
    if (!target) throw new HrError("NOT_FOUND", "Staff member not found.");
    const row = await tenantDb().trainingRecord.create({
      data: {
        userId: input.userId, userName: target.fullName, title: input.title,
        provider: input.provider || null, date: input.date, durationDays: input.durationDays,
        certificateUrl: input.certificateUrl || null,
      } as never,
    });
    await audit(user, "hr.training_added", "trainingRecord", row.id, { userId: input.userId, title: input.title });
    return row;
  });
}

/** One staff member's full HR file (records tab). */
export async function staffFile(user: SessionUser, userId: string) {
  return withTenant(user.tenantId, async () => {
    const target = await tenantDb().user.findUnique({ where: { id: userId }, select: { id: true, fullName: true, role: true, phone: true, email: true } });
    if (!target) throw new HrError("NOT_FOUND", "Staff member not found.");
    const [profile, leave, appraisals, disciplinary, training, balances] = await Promise.all([
      tenantDb().staffProfile.findFirst({ where: { userId } }),
      tenantDb().leaveRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
      tenantDb().appraisal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
      tenantDb().disciplinaryRecord.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 10 }),
      tenantDb().trainingRecord.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 10 }),
      leaveBalances(user, userId),
    ]);
    return { staff: target, profile, leave, appraisals, disciplinary, training, balances };
  });
}
