import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";
import { type PathwayInput, type StudentPathwayPreferenceInput, type StudentPathwayAllocationInput } from "@/lib/validations/pathways";

export class PathwayError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "PathwayError";
  }
}

// =============================================================================
// Audit helper
// =============================================================================
async function writeAudit(
  user: SessionUser,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>
) {
  try {
    await tenantDb().auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action,
        entityType,
        entityId,
        metadata: JSON.stringify(metadata),
      },
    });
  } catch {
    // Audit logging should never block the primary action.
  }
}

export async function getPathways(user: SessionUser) {
  const tDb = tenantDb();
  return tDb.pathway.findMany({
    include: {
      subjectRequirements: {
        include: { subject: true },
      },
      _count: { select: { studentPreferences: { where: { isAllocated: true } } } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createPathway(user: SessionUser, input: PathwayInput) {
  const tDb = tenantDb();

  const existing = await tDb.pathway.findUnique({
    where: { tenantId_code: { tenantId: user.tenantId, code: input.code } },
  });
  if (existing) throw new PathwayError("CONFLICT", "A pathway with this code already exists.");

  const pathway = await tDb.pathway.create({
    data: {
      tenantId: user.tenantId,
      name: input.name,
      code: input.code,
      description: input.description || null,
      capacity: input.capacity || null,
      subjectRequirements: {
        create: input.requirements?.map(req => ({
          tenantId: user.tenantId,
          subjectId: req.subjectId,
          isCore: req.isCore,
          minScorePct: req.minScorePct || null,
        })) || []
      }
    },
    include: { subjectRequirements: true }
  });

  await writeAudit(user, "pathway.created", "Pathway", pathway.id, {
    name: pathway.name, code: pathway.code, requirementCount: pathway.subjectRequirements.length,
  });

  return pathway;
}

export async function updatePathway(user: SessionUser, id: string, input: PathwayInput) {
  const tDb = tenantDb();

  const existing = await tDb.pathway.findUnique({ where: { id } });
  if (!existing) throw new PathwayError("NOT_FOUND", "Pathway not found.");

  // For simplicity, we drop and recreate requirements
  await tDb.pathwaySubjectRequirement.deleteMany({ where: { pathwayId: id } });

  const pathway = await tDb.pathway.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code,
      description: input.description || null,
      capacity: input.capacity || null,
      subjectRequirements: {
        create: input.requirements?.map(req => ({
          tenantId: user.tenantId,
          subjectId: req.subjectId,
          isCore: req.isCore,
          minScorePct: req.minScorePct || null,
        })) || []
      }
    },
    include: { subjectRequirements: { include: { subject: true } } }
  });

  await writeAudit(user, "pathway.updated", "Pathway", pathway.id, {
    name: pathway.name, code: pathway.code, requirementCount: pathway.subjectRequirements.length,
  });

  return pathway;
}

export async function deletePathway(user: SessionUser, id: string) {
  const tDb = tenantDb();

  const existing = await tDb.pathway.findUnique({
    where: { id },
    include: { _count: { select: { studentPreferences: true } } }
  });
  if (!existing) throw new PathwayError("NOT_FOUND", "Pathway not found.");

  if (existing._count.studentPreferences > 0) {
    throw new PathwayError("CONFLICT", "Cannot delete pathway with existing student preferences or allocations.");
  }

  const result = await tDb.pathway.delete({ where: { id } });
  await writeAudit(user, "pathway.deleted", "Pathway", id, { name: existing.name, code: existing.code });
  return result;
}

// =============================================================================
// Preference & Allocation Management
// =============================================================================
export async function getStudentPreferences(user: SessionUser, studentId: string) {
  return tenantDb().studentPathwayPreference.findMany({
    where: { studentId },
    include: { pathway: true },
    orderBy: { choiceOrder: "asc" }
  });
}

export async function setStudentPreferences(user: SessionUser, studentId: string, preferences: StudentPathwayPreferenceInput[]) {
  const tDb = tenantDb();

  const student = await tDb.student.findUnique({ where: { id: studentId } });
  if (!student) throw new PathwayError("NOT_FOUND", "Student not found.");

  const orders = preferences.map(p => p.choiceOrder);
  if (new Set(orders).size !== orders.length) {
    throw new PathwayError("INVALID", "Each preference must have a different choice order (1st, 2nd, 3rd).");
  }
  const ids = preferences.map(p => p.pathwayId);
  if (new Set(ids).size !== ids.length) {
    throw new PathwayError("INVALID", "The same pathway cannot be chosen twice.");
  }
  if (ids.length > 0) {
    const count = await tDb.pathway.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new PathwayError("NOT_FOUND", "One or more selected pathways do not exist.");
  }

  // Clear old preferences that are NOT YET allocated (preserve any final allocation).
  await tDb.studentPathwayPreference.deleteMany({ where: { studentId, isAllocated: false } });

  for (const pref of preferences) {
    await tDb.studentPathwayPreference.upsert({
      where: { tenantId_studentId_pathwayId: { tenantId: user.tenantId, studentId, pathwayId: pref.pathwayId } },
      create: { tenantId: user.tenantId, studentId, pathwayId: pref.pathwayId, choiceOrder: pref.choiceOrder },
      update: { choiceOrder: pref.choiceOrder },
    });
  }

  await writeAudit(user, "pathway.preferences_set", "Student", studentId, { count: preferences.length, pathwayIds: ids });
  return getStudentPreferences(user, studentId);
}

export async function allocateStudentToPathway(user: SessionUser, studentId: string, input: StudentPathwayAllocationInput) {
  const tDb = tenantDb();

  const pathway = await tDb.pathway.findUnique({
    where: { id: input.pathwayId },
    include: { _count: { select: { studentPreferences: { where: { isAllocated: true } } } } },
  });
  if (!pathway) throw new PathwayError("NOT_FOUND", "Pathway not found.");

  const alreadyHere = await tDb.studentPathwayPreference.findUnique({
    where: { tenantId_studentId_pathwayId: { tenantId: user.tenantId, studentId, pathwayId: input.pathwayId } },
  });

  // Enforce capacity: only when newly taking a seat in a pathway that is already full.
  if (input.isAllocated && pathway.capacity != null) {
    const wouldBeNewSeat = !(alreadyHere?.isAllocated);
    if (wouldBeNewSeat && pathway._count.studentPreferences >= pathway.capacity) {
      throw new PathwayError(
        "CONFLICT",
        `${pathway.name} is full (${pathway._count.studentPreferences}/${pathway.capacity}). Increase capacity or allocate to another pathway.`
      );
    }
  }

  // A student belongs to one pathway — reset other allocations.
  await tDb.studentPathwayPreference.updateMany({
    where: { studentId, isAllocated: true },
    data: { isAllocated: false }
  });

  const pref = await tDb.studentPathwayPreference.upsert({
    where: { tenantId_studentId_pathwayId: { tenantId: user.tenantId, studentId, pathwayId: input.pathwayId } },
    create: {
      tenantId: user.tenantId, studentId, pathwayId: input.pathwayId, choiceOrder: 1,
      isAllocated: input.isAllocated, isRecommended: input.isRecommended, teacherNotes: input.teacherNotes || null,
    },
    update: {
      isAllocated: input.isAllocated, isRecommended: input.isRecommended, teacherNotes: input.teacherNotes || null,
    }
  });

  await writeAudit(user, "pathway.allocated", "Student", studentId, {
    pathwayId: input.pathwayId, pathwayName: pathway.name, isAllocated: input.isAllocated,
  });

  return pref;
}

// =============================================================================
// J.10 — Pathway Readiness Engine
// =============================================================================
export type SubjectReadiness = {
  subjectId: string;
  subjectName: string;
  isCore: boolean;
  minScorePct: number | null;
  studentAvgPct: number | null;
  met: boolean;
};

export type PathwayReadiness = {
  pathwayId: string;
  pathwayName: string;
  pathwayCode: string;
  capacity: number | null;
  allocatedCount: number;
  seatsLeft: number | null;
  isChoice: boolean;
  choiceOrder: number | null;
  isAllocated: boolean;
  isRecommended: boolean;
  subjects: SubjectReadiness[];
  requirementsMet: number;
  requirementsTotal: number;
  academicReadinessPct: number;
  talentEvidenceCount: number;
  portfolioEvidenceCount: number;
  overallReadiness: "READY" | "ALMOST" | "DEVELOPING" | "NO_DATA";
};

async function buildSubjectAverages(studentId: string): Promise<Map<string, number>> {
  const tDb = tenantDb();
  const results = await tDb.examResult.findMany({
    where: { studentId },
    include: { exam: { select: { maxMarks: true } } },
  });

  const bySubject = new Map<string, { totalPct: number; count: number }>();
  for (const r of results) {
    const max = r.exam?.maxMarks || 100;
    if (max <= 0) continue;
    const pct = Math.max(0, Math.min(100, Math.round((r.marks / max) * 100)));
    const agg = bySubject.get(r.subjectId) || { totalPct: 0, count: 0 };
    agg.totalPct += pct;
    agg.count += 1;
    bySubject.set(r.subjectId, agg);
  }

  const avg = new Map<string, number>();
  for (const [subjectId, agg] of bySubject.entries()) {
    avg.set(subjectId, Math.round(agg.totalPct / agg.count));
  }
  return avg;
}

export async function getStudentPathwayReadiness(user: SessionUser, studentId: string): Promise<{
  student: { id: string; name: string; admissionNo: string };
  pathways: PathwayReadiness[];
}> {
  const tDb = tenantDb();

  const student = await tDb.student.findUnique({ where: { id: studentId } });
  if (!student) throw new PathwayError("NOT_FOUND", "Student not found.");

  const [pathways, preferences, subjectAvgs, talentEvidenceCount, portfolioEvidenceCount] = await Promise.all([
    tDb.pathway.findMany({
      include: {
        subjectRequirements: { include: { subject: true } },
        _count: { select: { studentPreferences: { where: { isAllocated: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    tDb.studentPathwayPreference.findMany({ where: { studentId } }),
    buildSubjectAverages(studentId),
    tDb.talentRecord.count({ where: { studentId } }),
    tDb.portfolioItem.count({ where: { studentId, status: "APPROVED" } }),
  ]);

  const prefByPathway = new Map(preferences.map(p => [p.pathwayId, p]));

  const readiness: PathwayReadiness[] = pathways.map(p => {
    const subjects: SubjectReadiness[] = p.subjectRequirements.map(req => {
      const studentAvg = subjectAvgs.has(req.subjectId) ? subjectAvgs.get(req.subjectId)! : null;
      const threshold = req.minScorePct ?? null;
      const met = studentAvg != null && (threshold == null ? true : studentAvg >= threshold);
      return {
        subjectId: req.subjectId,
        subjectName: req.subject?.name || "Subject",
        isCore: req.isCore,
        minScorePct: threshold,
        studentAvgPct: studentAvg,
        met,
      };
    });

    const requirementsTotal = subjects.length;
    const requirementsMet = subjects.filter(s => s.met).length;
    const hasAnyData = subjects.some(s => s.studentAvgPct != null);
    const academicReadinessPct = requirementsTotal === 0 ? 0 : Math.round((requirementsMet / requirementsTotal) * 100);

    let overallReadiness: PathwayReadiness["overallReadiness"];
    if (requirementsTotal === 0) overallReadiness = "READY";
    else if (!hasAnyData) overallReadiness = "NO_DATA";
    else if (academicReadinessPct >= 100) overallReadiness = "READY";
    else if (academicReadinessPct >= 50) overallReadiness = "ALMOST";
    else overallReadiness = "DEVELOPING";

    const pref = prefByPathway.get(p.id);
    const allocatedCount = p._count.studentPreferences;

    return {
      pathwayId: p.id,
      pathwayName: p.name,
      pathwayCode: p.code,
      capacity: p.capacity ?? null,
      allocatedCount,
      seatsLeft: p.capacity != null ? Math.max(0, p.capacity - allocatedCount) : null,
      isChoice: !!pref,
      choiceOrder: pref?.choiceOrder ?? null,
      isAllocated: pref?.isAllocated ?? false,
      isRecommended: pref?.isRecommended ?? false,
      subjects,
      requirementsMet,
      requirementsTotal,
      academicReadinessPct,
      talentEvidenceCount,
      portfolioEvidenceCount,
      overallReadiness,
    };
  });

  return {
    student: { id: student.id, name: `${student.firstName} ${student.lastName}`.trim(), admissionNo: student.admissionNo },
    pathways: readiness,
  };
}

// =============================================================================
// J.10 — Pathway Report (school-wide overview for export)
// =============================================================================
export type PathwayReportRow = {
  pathwayName: string;
  pathwayCode: string;
  description: string | null;
  capacity: number | null;
  allocatedCount: number;
  seatsLeft: number | null;
  fillPct: number | null;
  requirements: { subjectName: string; isCore: boolean; minScorePct: number | null }[];
  allocatedStudents: { admissionNo: string; name: string }[];
};

export async function buildPathwayReport(user: SessionUser): Promise<{
  generatedAt: string;
  totals: { pathways: number; allocated: number; capacity: number | null };
  rows: PathwayReportRow[];
}> {
  const tDb = tenantDb();
  const pathways = await tDb.pathway.findMany({
    include: {
      subjectRequirements: { include: { subject: true } },
      studentPreferences: {
        where: { isAllocated: true },
        include: { student: { select: { admissionNo: true, firstName: true, lastName: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  let totalAllocated = 0;
  let totalCapacity: number | null = 0;

  const rows: PathwayReportRow[] = pathways.map((p) => {
    const allocatedCount = p.studentPreferences.length;
    totalAllocated += allocatedCount;
    if (p.capacity != null && totalCapacity != null) totalCapacity += p.capacity;
    return {
      pathwayName: p.name,
      pathwayCode: p.code,
      description: p.description,
      capacity: p.capacity ?? null,
      allocatedCount,
      seatsLeft: p.capacity != null ? Math.max(0, p.capacity - allocatedCount) : null,
      fillPct: p.capacity ? Math.round((allocatedCount / p.capacity) * 100) : null,
      requirements: p.subjectRequirements.map((r) => ({
        subjectName: r.subject?.name || "Subject",
        isCore: r.isCore,
        minScorePct: r.minScorePct ?? null,
      })),
      allocatedStudents: p.studentPreferences.map((sp) => ({
        admissionNo: sp.student.admissionNo,
        name: `${sp.student.firstName} ${sp.student.lastName}`.trim(),
      })),
    };
  });

  await writeAudit(user, "pathway.report_generated", "Pathway", "report", {
    pathways: rows.length, allocated: totalAllocated,
  });

  return {
    generatedAt: new Date().toISOString(),
    totals: { pathways: rows.length, allocated: totalAllocated, capacity: totalCapacity },
    rows,
  };
}
