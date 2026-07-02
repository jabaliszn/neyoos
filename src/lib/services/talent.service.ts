import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";
import { type TalentAreaInput, type TalentRecordInput } from "@/lib/validations/talents";

export class TalentError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "TalentError";
  }
}

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
    // never block the primary action
  }
}

/** Map a 1..100 coach score to a 1..5 Skills Passport star rating. */
function scoreToRating(score: number | null | undefined): number {
  if (score == null) return 3; // neutral when no numeric score given
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  return 1;
}

/** Map a talent area category to a Skills Passport skill area label. */
function categoryToSkillArea(category: string, areaName: string): string {
  switch (category) {
    case "SPORTS": return "Sports";
    case "ARTS": return "Creativity";
    case "STEM": return "Coding";
    case "LEADERSHIP": return "Leadership";
    default: return areaName;
  }
}

// =============================================================================
// Talent Areas (Co-curricular setup)
// =============================================================================
export async function getTalentAreas(user: SessionUser) {
  return tenantDb().talentArea.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { records: true } } },
  });
}

export async function createTalentArea(user: SessionUser, input: TalentAreaInput) {
  const tDb = tenantDb();
  const existing = await tDb.talentArea.findUnique({
    where: { tenantId_name: { tenantId: user.tenantId, name: input.name } },
  });
  if (existing) throw new TalentError("CONFLICT", "A talent area with this name already exists.");

  const area = await tDb.talentArea.create({
    data: {
      tenantId: user.tenantId,
      name: input.name,
      category: input.category,
      description: input.description || null,
    }
  });
  await writeAudit(user, "talent.area_created", "TalentArea", area.id, { name: area.name, category: area.category });
  return area;
}

export async function updateTalentArea(user: SessionUser, id: string, input: TalentAreaInput) {
  const tDb = tenantDb();
  const existing = await tDb.talentArea.findUnique({ where: { id } });
  if (!existing) throw new TalentError("NOT_FOUND", "Talent area not found.");

  const nameConflict = await tDb.talentArea.findUnique({
    where: { tenantId_name: { tenantId: user.tenantId, name: input.name } },
  });
  if (nameConflict && nameConflict.id !== id) {
    throw new TalentError("CONFLICT", "A talent area with this name already exists.");
  }

  const area = await tDb.talentArea.update({
    where: { id },
    data: {
      name: input.name,
      category: input.category,
      description: input.description || null,
    }
  });
  await writeAudit(user, "talent.area_updated", "TalentArea", area.id, { name: area.name });
  return area;
}

export async function deleteTalentArea(user: SessionUser, id: string) {
  const tDb = tenantDb();
  const existing = await tDb.talentArea.findUnique({
    where: { id },
    include: { _count: { select: { records: true } } }
  });
  if (!existing) throw new TalentError("NOT_FOUND", "Talent area not found.");
  if (existing._count.records > 0) throw new TalentError("CONFLICT", "Cannot delete area with existing records.");

  const result = await tDb.talentArea.delete({ where: { id } });
  await writeAudit(user, "talent.area_deleted", "TalentArea", id, { name: existing.name });
  return result;
}

// =============================================================================
// Talent Records (Evaluation & Tracking)
// =============================================================================
export async function getStudentTalentRecords(user: SessionUser, studentId: string) {
  return tenantDb().talentRecord.findMany({
    where: { studentId },
    include: {
      talentArea: true,
      term: true,
      coach: { select: { id: true, fullName: true } }
    },
    orderBy: { dateRecorded: "desc" }
  });
}

export async function recordStudentTalent(user: SessionUser, input: TalentRecordInput) {
  const tDb = tenantDb();

  const student = await tDb.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new TalentError("NOT_FOUND", "Student not found.");

  const area = await tDb.talentArea.findUnique({ where: { id: input.talentAreaId } });
  if (!area) throw new TalentError("NOT_FOUND", "Talent area not found.");

  // If a portfolio item is linked, confirm it belongs to the same student.
  if (input.portfolioItemId) {
    const item = await tDb.portfolioItem.findUnique({ where: { id: input.portfolioItemId } });
    if (!item || item.studentId !== input.studentId) {
      throw new TalentError("INVALID", "Linked portfolio item does not belong to this student.");
    }
  }

  const record = await tDb.talentRecord.create({
    data: {
      tenantId: user.tenantId,
      studentId: input.studentId,
      talentAreaId: input.talentAreaId,
      termId: input.termId || null,
      coachId: user.id,
      score: input.score || null,
      notes: input.notes || null,
      portfolioItemId: input.portfolioItemId || null,
    },
    include: { talentArea: true, coach: { select: { fullName: true } } }
  });

  // J.11 line: talent evidence links to the Skills Passport (J.6).
  // Every talent record is mirrored as a Skills Passport entry so it shows up in
  // the learner's portable Skills Passport and PDF.
  try {
    await tDb.skillsPassportEntry.create({
      data: {
        tenantId: user.tenantId,
        studentId: input.studentId,
        skillArea: categoryToSkillArea(area.category, area.name),
        ratingLevel: scoreToRating(input.score ?? null),
        evidenceSource: input.portfolioItemId ? "PORTFOLIO" : "CLUB",
        sourceId: input.portfolioItemId || record.id,
        narrative: input.notes || `${area.name} talent record`,
        evidenceDate: new Date().toISOString().slice(0, 10),
        recordedById: user.id,
        recordedByName: user.fullName,
        verified: true,
      },
    });
  } catch {
    // Skills Passport mirroring is best-effort; the talent record is the source of truth.
  }

  await writeAudit(user, "talent.record_created", "TalentRecord", record.id, {
    studentId: input.studentId,
    talentAreaId: input.talentAreaId,
    score: input.score ?? null,
    linkedPortfolio: !!input.portfolioItemId,
  });

  return record;
}

export async function deleteTalentRecord(user: SessionUser, id: string) {
  const tDb = tenantDb();
  const record = await tDb.talentRecord.findUnique({ where: { id } });
  if (!record) throw new TalentError("NOT_FOUND", "Record not found.");

  // Remove the mirrored Skills Passport entry created from this record (if any).
  try {
    await tDb.skillsPassportEntry.deleteMany({ where: { studentId: record.studentId, sourceId: record.id } });
  } catch {
    // best-effort cleanup
  }

  const result = await tDb.talentRecord.delete({ where: { id } });
  await writeAudit(user, "talent.record_deleted", "TalentRecord", id, { studentId: record.studentId });
  return result;
}

// =============================================================================
// J.11 — Talent participation analytics (per class / grade / gender / term)
// =============================================================================
export type TalentAnalytics = {
  totals: { records: number; students: number; areas: number };
  byArea: { areaId: string; name: string; category: string; records: number; students: number; avgScore: number | null }[];
  byClass: { classId: string | null; label: string; records: number; students: number }[];
  byGrade: { grade: string; records: number; students: number }[];
  byGender: { gender: string; label: string; records: number; students: number }[];
  byTerm: { termId: string | null; label: string; records: number; students: number }[];
};

export async function getTalentParticipationAnalytics(user: SessionUser, filters?: { termId?: string | null }): Promise<TalentAnalytics> {
  const tDb = tenantDb();

  const records = await tDb.talentRecord.findMany({
    where: filters?.termId ? { termId: filters.termId } : {},
    include: {
      talentArea: { select: { id: true, name: true, category: true } },
      term: { select: { id: true, year: true, term: true } },
      student: {
        select: {
          id: true,
          gender: true,
          classId: true,
          schoolClass: { select: { level: true, stream: true } },
        },
      },
    },
  });

  const areaCount = await tDb.talentArea.count();

  // helper to track records + unique students per key
  function bucket() {
    return new Map<string, { records: number; students: Set<string>; meta?: any }>();
  }
  const areaB = bucket();
  const classB = bucket();
  const gradeB = bucket();
  const genderB = bucket();
  const termB = bucket();
  const areaScores = new Map<string, { sum: number; n: number }>();
  const allStudents = new Set<string>();

  function add(b: ReturnType<typeof bucket>, key: string, studentId: string, meta?: any) {
    const cur = b.get(key) || { records: 0, students: new Set<string>(), meta };
    cur.records += 1;
    cur.students.add(studentId);
    if (meta && !cur.meta) cur.meta = meta;
    b.set(key, cur);
  }

  for (const r of records) {
    const sid = r.student.id;
    allStudents.add(sid);

    add(areaB, r.talentArea.id, sid, { name: r.talentArea.name, category: r.talentArea.category });
    if (r.score != null) {
      const cur = areaScores.get(r.talentArea.id) || { sum: 0, n: 0 };
      cur.sum += r.score; cur.n += 1;
      areaScores.set(r.talentArea.id, cur);
    }

    const classKey = r.student.classId || "__none__";
    const classLabel = r.student.schoolClass
      ? `${r.student.schoolClass.level}${r.student.schoolClass.stream ? " " + r.student.schoolClass.stream : ""}`
      : "Unassigned";
    add(classB, classKey, sid, { classId: r.student.classId, label: classLabel });

    const grade = r.student.schoolClass?.level || "Unassigned";
    add(gradeB, grade, sid);

    const g = r.student.gender || "U";
    add(genderB, g, sid);

    const termKey = r.term?.id || "__none__";
    const termLabel = r.term ? `Term ${r.term.term} ${r.term.year}` : "No term";
    add(termB, termKey, sid, { termId: r.term?.id || null, label: termLabel });
  }

  const genderLabel: Record<string, string> = { M: "Boys", F: "Girls", U: "Unspecified" };

  return {
    totals: { records: records.length, students: allStudents.size, areas: areaCount },
    byArea: [...areaB.entries()].map(([id, v]) => ({
      areaId: id,
      name: v.meta?.name || "Unknown",
      category: v.meta?.category || "OTHER",
      records: v.records,
      students: v.students.size,
      avgScore: areaScores.has(id) ? Math.round(areaScores.get(id)!.sum / areaScores.get(id)!.n) : null,
    })).sort((a, b) => b.records - a.records),
    byClass: [...classB.entries()].map(([key, v]) => ({
      classId: key === "__none__" ? null : key,
      label: v.meta?.label || "Unassigned",
      records: v.records,
      students: v.students.size,
    })).sort((a, b) => b.records - a.records),
    byGrade: [...gradeB.entries()].map(([grade, v]) => ({
      grade,
      records: v.records,
      students: v.students.size,
    })).sort((a, b) => b.records - a.records),
    byGender: [...genderB.entries()].map(([g, v]) => ({
      gender: g,
      label: genderLabel[g] || g,
      records: v.records,
      students: v.students.size,
    })),
    byTerm: [...termB.entries()].map(([key, v]) => ({
      termId: v.meta?.termId ?? null,
      label: v.meta?.label || "No term",
      records: v.records,
      students: v.students.size,
    })),
  };
}

// =============================================================================
// J.11 — Talent Report (school-wide, exportable)
// =============================================================================
export async function buildTalentReport(user: SessionUser, filters?: { termId?: string | null }) {
  const analytics = await getTalentParticipationAnalytics(user, filters);
  let termLabel = "All terms";
  if (filters?.termId) {
    const term = await tenantDb().academicTerm.findUnique({ where: { id: filters.termId } });
    termLabel = term ? `Term ${term.term} ${term.year}` : "Selected term";
  }
  await writeAudit(user, "talent.report_generated", "TalentArea", "report", {
    records: analytics.totals.records,
    students: analytics.totals.students,
    termId: filters?.termId ?? null,
  });
  return { generatedAt: new Date().toISOString(), termLabel, analytics };
}
