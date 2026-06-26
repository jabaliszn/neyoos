/**
 * B.21 Medical / Clinic — student medical profiles (blood group, chronic
 * conditions, ALLERGIES w/ alerts), sickbay visit log (referrals SMS the
 * guardian), medication plans with a per-dose administration trail, and a
 * health report (visit frequency + active medications + allergy register).
 *
 * Allergy alerts surface wherever the student appears in clinic flows, and
 * the kitchen board (B.19) pulls the food-allergy register.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { scopeWhere } from "@/lib/services/student.service";
import { sendSms } from "@/lib/notifications/sms";
import { checkSmsQuota, recordUsage } from "@/lib/services/limits.service";
import type { SessionUser } from "@/lib/core/session";

export class ClinicError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "ALREADY", message: string) {
    super(message);
    this.name = "ClinicError";
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

const fullName = (s: { firstName: string; middleName: string | null; lastName: string }) =>
  [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");

function parseAllergies(s: string | null): string[] {
  if (!s) return [];
  try { return JSON.parse(s) as string[]; } catch { return []; }
}

// ---------------------------------------------------------------------------
// Medical profile (B.21.2 history + B.21.3 allergies)
// ---------------------------------------------------------------------------

export async function upsertMedicalProfile(
  user: SessionUser,
  input: { studentId: string; bloodGroup?: string; conditions?: string; allergies?: string[]; shaNumber?: string; notes?: string }
) {
  return withTenant(user.tenantId, async () => {
    const student = await tenantDb().student.findFirst({ where: { id: input.studentId, deletedAt: null } });
    if (!student) throw new ClinicError("NOT_FOUND", "Student not found.");
    const row = await db.studentMedical.upsert({
      where: { studentId: student.id },
      create: {
        tenantId: user.tenantId, studentId: student.id,
        bloodGroup: input.bloodGroup || null, conditions: input.conditions || null,
        allergies: input.allergies?.length ? JSON.stringify(input.allergies) : null,
        shaNumber: input.shaNumber || null, notes: input.notes || null,
      },
      update: {
        ...(input.bloodGroup !== undefined ? { bloodGroup: input.bloodGroup || null } : {}),
        ...(input.conditions !== undefined ? { conditions: input.conditions || null } : {}),
        ...(input.allergies !== undefined ? { allergies: input.allergies.length ? JSON.stringify(input.allergies) : null } : {}),
        ...(input.shaNumber !== undefined ? { shaNumber: input.shaNumber || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      },
    });
    await audit(user, "clinic.profile_updated", "studentMedical", row.id, { student: fullName(student) });
    return row;
  });
}

/** Full medical file for one student (profile + visits + medications). */
export async function medicalFile(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const student = await tenantDb().student.findFirst({ where: { id: studentId, deletedAt: null }, include: { schoolClass: true } });
    if (!student) throw new ClinicError("NOT_FOUND", "Student not found.");
    const [profile, visits, plans] = await Promise.all([
      tenantDb().studentMedical.findFirst({ where: { studentId } }),
      tenantDb().clinicVisit.findMany({ where: { studentId }, orderBy: { date: "desc" }, take: 30 }),
      tenantDb().medicationPlan.findMany({ where: { studentId }, include: { doses: { orderBy: { givenAt: "desc" }, take: 10 } }, orderBy: { createdAt: "desc" } }),
    ]);
    return {
      student: {
        id: student.id, name: fullName(student), admissionNo: student.admissionNo,
        className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
      },
      profile: profile
        ? { bloodGroup: profile.bloodGroup, conditions: profile.conditions, allergies: parseAllergies(profile.allergies), shaNumber: profile.shaNumber, notes: profile.notes }
        : { bloodGroup: null, conditions: null, allergies: [], shaNumber: null, notes: null },
      visits,
      plans: plans.map((p) => ({
        id: p.id, drug: p.drug, dosage: p.dosage, frequency: p.frequency,
        startDate: p.startDate, endDate: p.endDate, active: p.active,
        doses: p.doses,
      })),
    };
  });
}

/** ALLERGY REGISTER (B.21.3 alerts) — every student with allergies, for the clinic + kitchen. */
export async function allergyRegister(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().studentMedical.findMany({ where: { allergies: { not: null } } });
    const ids = rows.map((r) => r.studentId);
    const students = ids.length
      ? await tenantDb().student.findMany({ where: { id: { in: ids }, deletedAt: null }, include: { schoolClass: true } })
      : [];
    const sMap = new Map(students.map((s) => [s.id, s]));
    return rows
      .map((r) => {
        const s = sMap.get(r.studentId);
        if (!s) return null;
        return {
          studentId: r.studentId,
          studentName: fullName(s),
          admissionNo: s.admissionNo,
          className: s.schoolClass ? [s.schoolClass.level, s.schoolClass.stream].filter(Boolean).join(" ") : null,
          allergies: parseAllergies(r.allergies),
          conditions: r.conditions,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  });
}

// ---------------------------------------------------------------------------
// Clinic visits (B.21.1) — referral = guardian SMS
// ---------------------------------------------------------------------------

export async function recordVisit(
  user: SessionUser,
  input: { studentId: string; date: string; complaint: string; treatment: string; medicationGiven?: string; referredTo?: string }
) {
  return withTenant(user.tenantId, async () => {
    const student = await tenantDb().student.findFirst({ where: { id: input.studentId, deletedAt: null } });
    if (!student) throw new ClinicError("NOT_FOUND", "Student not found.");

    // ALLERGY ALERT: warn if medication given matches a recorded allergy.
    const profile = await tenantDb().studentMedical.findFirst({ where: { studentId: student.id } });
    const allergies = parseAllergies(profile?.allergies ?? null);
    let allergyWarning: string | null = null;
    if (input.medicationGiven && allergies.length) {
      const hit = allergies.find((a) => input.medicationGiven!.toLowerCase().includes(a.toLowerCase()));
      if (hit) allergyWarning = `⚠ ${student.firstName} is recorded as ALLERGIC to ${hit} — verify before administering!`;
    }

    const visit = await db.clinicVisit.create({
      data: {
        tenantId: user.tenantId, studentId: student.id,
        studentName: fullName(student), admissionNo: student.admissionNo,
        date: input.date, complaint: input.complaint, treatment: input.treatment,
        medicationGiven: input.medicationGiven ?? null, referredTo: input.referredTo ?? null,
        recordedById: user.id, recordedByName: user.fullName,
      },
    });

    // Referral out -> guardian SMS immediately.
    let parentNotified = false;
    if (input.referredTo) {
      const quota = await checkSmsQuota(user.tenantId, 1);
      if (quota.allowed) {
        const link =
          (await tenantDb().studentGuardian.findFirst({ where: { studentId: student.id, isPrimary: true }, include: { guardian: true } })) ??
          (await tenantDb().studentGuardian.findFirst({ where: { studentId: student.id }, include: { guardian: true } }));
        if (link?.guardian.phone) {
          const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true } });
          try {
            await sendSms(link.guardian.phone, `${tenant.name}: ${student.firstName} ${student.lastName} visited the school clinic today (${input.complaint}) and has been referred to ${input.referredTo}. Please contact the school immediately.`);
            await recordUsage(user.tenantId, "smsPerTerm", 1);
            parentNotified = true;
            await tenantDb().clinicVisit.update({ where: { id: visit.id }, data: { parentNotifiedAt: new Date() } });
          } catch { /* skip */ }
        }
      }
    }

    await audit(user, "clinic.visit_recorded", "clinicVisit", visit.id, {
      student: visit.studentName, complaint: input.complaint, referred: input.referredTo ?? null, parentNotified,
    });
    return { id: visit.id, parentNotified, allergyWarning, allergies };
  });
}

export async function listVisits(user: SessionUser, q: { date?: string } = {}) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().clinicVisit.findMany({
      where: q.date ? { date: q.date } : {},
      orderBy: { createdAt: "desc" }, take: 50,
    });
  });
}

// ---------------------------------------------------------------------------
// Medication tracking (B.21.4)
// ---------------------------------------------------------------------------

export async function startMedication(
  user: SessionUser,
  input: { studentId: string; drug: string; dosage: string; frequency: string; startDate: string; endDate?: string }
) {
  return withTenant(user.tenantId, async () => {
    const student = await tenantDb().student.findFirst({ where: { id: input.studentId, deletedAt: null } });
    if (!student) throw new ClinicError("NOT_FOUND", "Student not found.");

    // Allergy guard on the plan itself.
    const profile = await tenantDb().studentMedical.findFirst({ where: { studentId: student.id } });
    const allergies = parseAllergies(profile?.allergies ?? null);
    const hit = allergies.find((a) => input.drug.toLowerCase().includes(a.toLowerCase()));
    if (hit) throw new ClinicError("INVALID", `${student.firstName} is recorded as ALLERGIC to ${hit}. Choose a different medication or update the allergy record first.`);

    const plan = await db.medicationPlan.create({
      data: {
        tenantId: user.tenantId, studentId: student.id, studentName: fullName(student),
        drug: input.drug, dosage: input.dosage, frequency: input.frequency,
        startDate: input.startDate, endDate: input.endDate ?? null, createdById: user.id,
      },
    });
    await audit(user, "clinic.medication_started", "medicationPlan", plan.id, { student: plan.studentName, drug: input.drug });
    return plan;
  });
}

export async function giveDose(user: SessionUser, planId: string, note?: string) {
  return withTenant(user.tenantId, async () => {
    const plan = await tenantDb().medicationPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new ClinicError("NOT_FOUND", "Medication plan not found.");
    if (!plan.active) throw new ClinicError("INVALID", "This plan is closed.");
    const dose = await db.medicationDose.create({
      data: { tenantId: user.tenantId, planId, byId: user.id, byName: user.fullName, note: note ?? null },
    });
    await audit(user, "clinic.dose_given", "medicationDose", dose.id, { drug: plan.drug, student: plan.studentName });
    return dose;
  });
}

export async function stopMedication(user: SessionUser, planId: string) {
  return withTenant(user.tenantId, async () => {
    const plan = await tenantDb().medicationPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new ClinicError("NOT_FOUND", "Medication plan not found.");
    if (!plan.active) throw new ClinicError("ALREADY", "Already stopped.");
    const row = await tenantDb().medicationPlan.update({ where: { id: planId }, data: { active: false } });
    await audit(user, "clinic.medication_stopped", "medicationPlan", planId, { drug: plan.drug });
    return row;
  });
}

export async function activeMedications(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const plans = await tenantDb().medicationPlan.findMany({
      where: { active: true },
      include: { doses: { orderBy: { givenAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
    return plans.map((p) => ({
      id: p.id, studentName: p.studentName, drug: p.drug, dosage: p.dosage, frequency: p.frequency,
      startDate: p.startDate, endDate: p.endDate,
      lastDoseAt: p.doses[0]?.givenAt ?? null, lastDoseBy: p.doses[0]?.byName ?? null,
    }));
  });
}

// ---------------------------------------------------------------------------
// Health report (B.21.5)
// ---------------------------------------------------------------------------

export async function healthReport(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const year = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 4);
    const [visits, allergic, activePlans] = await Promise.all([
      tenantDb().clinicVisit.findMany({ where: { date: { gte: `${year}-01-01` } } }),
      allergyRegister(user),
      tenantDb().medicationPlan.count({ where: { active: true } }),
    ]);
    // Frequent visitors (≥3 visits this year) — possible chronic/welfare flag.
    const byStudent = new Map<string, { name: string; count: number }>();
    for (const v of visits) {
      const rec = byStudent.get(v.studentId) ?? { name: v.studentName, count: 0 };
      rec.count++;
      byStudent.set(v.studentId, rec);
    }
    const frequent = [...byStudent.entries()]
      .filter(([, r]) => r.count >= 3)
      .map(([studentId, r]) => ({ studentId, studentName: r.name, visits: r.count }))
      .sort((a, b) => b.visits - a.visits);
    const referrals = visits.filter((v) => v.referredTo).length;
    return {
      year,
      totalVisits: visits.length,
      referrals,
      allergicStudents: allergic.length,
      activeMedications: activePlans,
      frequentVisitors: frequent,
    };
  });
}

// ---------------------------------------------------------------------------
// Family portal: a child's own clinic summary (scoped)
// ---------------------------------------------------------------------------

export async function childHealth(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const child = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] } });
    if (!child) throw new ClinicError("NOT_FOUND", "Student not found.");
    const [visits, profile] = await Promise.all([
      tenantDb().clinicVisit.findMany({
        where: { studentId },
        orderBy: { date: "desc" }, take: 10,
        select: { id: true, date: true, complaint: true, treatment: true, referredTo: true },
      }),
      tenantDb().studentMedical.findFirst({ where: { studentId } }),
    ]);
    return {
      visits,
      allergies: parseAllergies(profile?.allergies ?? null),
      bloodGroup: profile?.bloodGroup ?? null,
    };
  });
}
