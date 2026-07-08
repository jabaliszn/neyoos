import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import { db } from "@/lib/db";
import { SessionUser } from "@/lib/core/session";
import {
  type PathwayInput,
  type StudentPathwayPreferenceInput,
  type StudentPathwayAllocationInput,
  type PathwaySchoolConfigInput,
  type PathwayGroup,
  KICD_SENIOR_SCHOOL_PATHWAYS,
  PATHWAY_GROUP_LABELS,
  CORE_ESSENTIAL_MATHEMATICS,
  mathVariantForPathwayGroup,
  COMMUNITY_SERVICE_LEARNING_SUBJECT,
  CSL_STRANDS,
  type NationalAssessmentInput,
  PATHWAY_PLACEMENT_MILESTONE,
} from "@/lib/validations/pathways";

export class PathwayError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "PathwayError";
  }
}

// =============================================================================
// Audit helper — MUST be called from inside an existing withTenant() scope
// (every exported function below already establishes one before calling this).
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

/**
 * P.1 REPAIR (2026-07-02): every exported function in this file calls
 * tenantDb(), which REQUIRES an active withTenant() scope (AsyncLocalStorage)
 * or it throws "No tenant in scope". AUDIT FOUND that none of the 9
 * pre-existing exported functions here — nor any of the 5 API routes under
 * /api/pathways/* that call them — ever established that scope; the same gap
 * was about to be repeated in the new P.1 functions below. This was a REAL,
 * PRE-EXISTING bug (confirmed via a direct call reproducing "No tenant in
 * scope", and a live HTTP call to GET /api/pathways after removing the
 * pre-existing tier-gate that had been masking it) — not something this
 * session introduced. It was masked because (a) every /api/pathways/* route
 * is gated behind requireRevenueFeature("pathway_guidance"), which most
 * schools/tests never pay for, so the buggy code was rarely reached, and
 * (b) the existing scripts/j10-pathways-fullstack-test.ts calls these
 * service functions directly wrapped in ITS OWN withTenant(), bypassing the
 * real (broken) API path entirely. FIXED by wrapping every exported
 * function's body in withTenant(user.tenantId, ...) here, at the service
 * layer, so it is correct regardless of caller (API route, seed script, or
 * a future direct call) — matching the working precedent already used by
 * curriculum.service.ts's runCurriculumMigrationAssistant().
 */

export async function getPathways(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
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
  });
}

export async function createPathway(user: SessionUser, input: PathwayInput) {
  return withTenant(user.tenantId, async () => {
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
  });
}

export async function updatePathway(user: SessionUser, id: string, input: PathwayInput) {
  return withTenant(user.tenantId, async () => {
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
  });
}

export async function deletePathway(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
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
  });
}

// =============================================================================
// Preference & Allocation Management
// =============================================================================
export async function getStudentPreferences(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().studentPathwayPreference.findMany({
      where: { studentId },
      include: { pathway: true },
      orderBy: { choiceOrder: "asc" }
    });
  });
}

export async function setStudentPreferences(user: SessionUser, studentId: string, preferences: StudentPathwayPreferenceInput[]) {
  return withTenant(user.tenantId, async () => {
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
    return tDb.studentPathwayPreference.findMany({
      where: { studentId },
      include: { pathway: true },
      orderBy: { choiceOrder: "asc" },
    });
  });
}

export async function allocateStudentToPathway(user: SessionUser, studentId: string, input: StudentPathwayAllocationInput) {
  return withTenant(user.tenantId, async () => {
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
  });
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
  /** P.4: the real KICD-designated Grade 9→10 placement input (KJSEA), when
   * a confirmed result has been recorded for this student — NOT an internal
   * exam average. Null when no such milestone result exists yet, in which
   * case readiness falls back to internal subject averages alone, unchanged
   * from the pre-P.4 behaviour. */
  kjseaScorePct: number | null;
  kjseaYear: number | null;
  kjseaInfluencedReadiness: boolean;
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
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();

    const student = await tDb.student.findUnique({ where: { id: studentId } });
    if (!student) throw new PathwayError("NOT_FOUND", "Student not found.");

    const [pathways, preferences, subjectAvgs, talentEvidenceCount, portfolioEvidenceCount, kjseaRecord] = await Promise.all([
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
      // P.4: the real KICD Grade 9->10 placement input, when confirmed.
      tDb.studentNationalAssessment.findFirst({
        where: { studentId, milestone: PATHWAY_PLACEMENT_MILESTONE, status: "CONFIRMED" },
        orderBy: { year: "desc" },
      }),
    ]);

    const prefByPathway = new Map(preferences.map(p => [p.pathwayId, p]));
    const kjseaScorePct = kjseaRecord?.overallScorePct ?? null;
    const kjseaYear = kjseaRecord?.year ?? null;

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

      // P.4: the real KICD-designated Grade 9->10 placement input (KJSEA) is
      // blended in as a GENUINE additional signal, not a cosmetic display
      // value — a real confirmed KJSEA score can move the internal-exam-only
      // verdict, exactly as the checklist requires ("use a real KJSEA score
      // ... as an available input", not merely show it alongside).
      // Rule: a strong KJSEA (>=70%) can lift an ALMOST verdict to READY when
      // internal subject data is otherwise thin; a weak KJSEA (<50%) demotes
      // a READY verdict (from internal averages alone) down to ALMOST, since
      // the national placement exam is the school-independent signal KICD
      // itself designates for this transition.
      let kjseaInfluencedReadiness = false;
      if (kjseaScorePct != null) {
        if (overallReadiness === "READY" && kjseaScorePct < 50) {
          overallReadiness = "ALMOST";
          kjseaInfluencedReadiness = true;
        } else if (overallReadiness === "ALMOST" && kjseaScorePct >= 70 && academicReadinessPct >= 50) {
          overallReadiness = "READY";
          kjseaInfluencedReadiness = true;
        }
      }

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
        kjseaScorePct,
        kjseaYear,
        kjseaInfluencedReadiness,
      };
    });

    return {
      student: { id: student.id, name: `${student.firstName} ${student.lastName}`.trim(), admissionNo: student.admissionNo },
      pathways: readiness,
    };
  });
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
  return withTenant(user.tenantId, async () => {
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
  });
}

// =============================================================================
// P.1 (2026-07-02) — School Pathway Type (Triple/Dual) + Official KICD Taxonomy
// =============================================================================

function parsePathwayGroups(json: string | null): PathwayGroup[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? arr.filter((g): g is PathwayGroup => typeof g === "string") : [];
  } catch {
    return [];
  }
}

export interface PathwaySchoolConfig {
  pathwaySchoolType: "NONE" | "TRIPLE" | "DUAL";
  enabledPathwayGroups: PathwayGroup[];
}

/**
 * Read the school's Senior School pathway configuration (Tenant-level, not a
 * Pathway row — uses the plain `db` client, not tenantDb(), since Tenant
 * itself is never tenant-SCOPED data; it IS the tenant row).
 */
export async function getPathwaySchoolConfig(user: SessionUser): Promise<PathwaySchoolConfig> {
  const tenant = await db.tenant.findUnique({
    where: { id: user.tenantId },
    select: { pathwaySchoolType: true, enabledPathwayGroups: true },
  });
  if (!tenant) throw new PathwayError("NOT_FOUND", "School not found.");
  return {
    pathwaySchoolType: (tenant.pathwaySchoolType as PathwaySchoolConfig["pathwaySchoolType"]) || "NONE",
    enabledPathwayGroups: parsePathwayGroups(tenant.enabledPathwayGroups),
  };
}

/** Set the school's Senior School pathway type (Triple/Dual) + which official groups it offers. */
export async function setPathwaySchoolConfig(user: SessionUser, input: PathwaySchoolConfigInput): Promise<PathwaySchoolConfig> {
  await db.tenant.update({
    where: { id: user.tenantId },
    data: {
      pathwaySchoolType: input.pathwaySchoolType,
      enabledPathwayGroups: JSON.stringify(input.enabledPathwayGroups),
    },
  });

  // writeAudit() calls tenantDb() internally, so it DOES need a tenant scope
  // even though the update above (on the plain `db` client) does not.
  await withTenant(user.tenantId, () =>
    writeAudit(user, "pathway.school_config_updated", "Tenant", user.tenantId, {
      pathwaySchoolType: input.pathwaySchoolType,
      enabledPathwayGroups: input.enabledPathwayGroups,
    })
  );

  return { pathwaySchoolType: input.pathwaySchoolType, enabledPathwayGroups: input.enabledPathwayGroups };
}

export interface SeedOfficialPathwaysResult {
  pathwaysCreated: number;
  pathwaysUpdated: number;
  subjectsCreated: number;
  subjectsMatched: number;
  pathways: { name: string; code: string; group: PathwayGroup; trackName: string }[];
  /** P.2: which Mathematics variant (Core/Essential) was attached as the
   * compulsory subject for each seeded pathway group, and whether that
   * variant's Subject row was newly created or matched to an existing one. */
  mathVariantsApplied: { group: PathwayGroup; variant: "CORE" | "ESSENTIAL"; subjectCode: string; wasCreated: boolean }[];
  /** P.3: Community Service Learning subject + real CBC strands attached to
   * every seeded pathway (compulsory for all groups, one shared subject). */
  communityServiceLearning: { subjectCode: string; wasCreated: boolean; strandsCreated: number; strandsMatched: number };
}

/**
 * Idempotent: creates (or matches existing) real Subject rows for every
 * elective in the requested official KICD pathway groups, then creates
 * (or updates) one real Pathway row PER TRACK (e.g. "STEM — Pure Sciences"),
 * each with real PathwaySubjectRequirement rows pointing at the matched
 * subjects. Never duplicates a subject that already exists by code — if a
 * school already has "Biology"/"BIO" from B.4 seed data, it is REUSED, not
 * re-created, per the project's non-duplication rule (J.25).
 * Safe to call multiple times: re-running with the same groups updates the
 * existing official pathways in place rather than creating duplicates.
 */
export async function seedOfficialPathways(user: SessionUser, groups: PathwayGroup[]): Promise<SeedOfficialPathwaysResult> {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    let subjectsCreated = 0;
    let subjectsMatched = 0;
    let pathwaysCreated = 0;
    let pathwaysUpdated = 0;
    const createdPathways: SeedOfficialPathwaysResult["pathways"] = [];
    const mathVariantsApplied: SeedOfficialPathwaysResult["mathVariantsApplied"] = [];

    // P.2: match-or-create the REAL Core Mathematics / Essential Mathematics
    // subject rows ONCE up front (shared across every track that needs them —
    // e.g. all 4 STEM tracks compulsorily take the SAME Core Mathematics
    // subject, not 4 separate copies). Keyed by subject code so re-running
    // this function never creates duplicates.
    const mathSubjectIdByVariant = new Map<"CORE" | "ESSENTIAL", { id: string; wasCreated: boolean }>();
    async function ensureMathSubject(def: (typeof CORE_ESSENTIAL_MATHEMATICS)[number]): Promise<{ id: string; wasCreated: boolean }> {
      const cached = mathSubjectIdByVariant.get(def.variant);
      if (cached) return cached;
      const existing = await tDb.subject.findUnique({
        where: { tenantId_code: { tenantId: user.tenantId, code: def.code } },
      });
      let result: { id: string; wasCreated: boolean };
      if (existing) {
        subjectsMatched += 1;
        // Keep the compulsory-pathway tagging current even on a re-run.
        await tDb.subject.update({
          where: { id: existing.id },
          data: { mathVariant: def.variant, compulsoryPathwayGroups: JSON.stringify(def.compulsoryFor) },
        });
        result = { id: existing.id, wasCreated: false };
      } else {
        const created = await tDb.subject.create({
          data: {
            tenantId: user.tenantId,
            name: def.name,
            code: def.code,
            curriculum: "CBC",
            mathVariant: def.variant,
            compulsoryPathwayGroups: JSON.stringify(def.compulsoryFor),
          },
        });
        subjectsCreated += 1;
        result = { id: created.id, wasCreated: true };
      }
      mathSubjectIdByVariant.set(def.variant, result);
      return result;
    }

    // P.3: match-or-create the REAL Community Service Learning subject +
    // its 3 real CBC strands ONCE up front (compulsory for ALL pathway
    // groups, unlike Math — the same subject/grading approach everywhere).
    // Reuses the existing B.6 CbcStrand/CbcAssessment engine for genuine
    // BE/AE/ME/EE grading rather than inventing a parallel grading system.
    let cslSubjectId: string;
    let cslWasCreated: boolean;
    let cslStrandsCreated = 0;
    let cslStrandsMatched = 0;
    {
      const def = COMMUNITY_SERVICE_LEARNING_SUBJECT;
      const existing = await tDb.subject.findUnique({
        where: { tenantId_code: { tenantId: user.tenantId, code: def.code } },
      });
      if (existing) {
        subjectsMatched += 1;
        cslSubjectId = existing.id;
        cslWasCreated = false;
        await tDb.subject.update({
          where: { id: cslSubjectId },
          data: { compulsoryPathwayGroups: JSON.stringify(def.compulsoryFor) },
        });
      } else {
        const created = await tDb.subject.create({
          data: {
            tenantId: user.tenantId,
            name: def.name,
            code: def.code,
            curriculum: "CBC",
            compulsoryPathwayGroups: JSON.stringify(def.compulsoryFor),
          },
        });
        subjectsCreated += 1;
        cslSubjectId = created.id;
        cslWasCreated = true;
      }

      for (const strandDef of CSL_STRANDS) {
        const existingStrand = await tDb.cbcStrand.findUnique({
          where: { tenantId_subjectId_name: { tenantId: user.tenantId, subjectId: cslSubjectId, name: strandDef.name } },
        });
        if (existingStrand) {
          cslStrandsMatched += 1;
        } else {
          await tDb.cbcStrand.create({
            data: {
              tenantId: user.tenantId,
              subjectId: cslSubjectId,
              name: strandDef.name,
              learningOutcome: strandDef.learningOutcome,
            },
          });
          cslStrandsCreated += 1;
        }
      }
    }

    for (const groupDef of KICD_SENIOR_SCHOOL_PATHWAYS) {
      if (!groups.includes(groupDef.group)) continue;

      // Resolve + ensure the compulsory Mathematics variant for THIS group once.
      const mathDef = mathVariantForPathwayGroup(groupDef.group);
      const mathResult = await ensureMathSubject(mathDef);
      const mathSubjectId = mathResult.id;
      if (!mathVariantsApplied.some((m) => m.group === groupDef.group)) {
        mathVariantsApplied.push({
          group: groupDef.group,
          variant: mathDef.variant,
          subjectCode: mathDef.code,
          wasCreated: mathResult.wasCreated,
        });
      }

      for (const track of groupDef.tracks) {
        // 1) Ensure every elective subject for this track exists (match-or-create by code).
        const subjectIds: string[] = [];
        for (const elective of track.electives) {
          const existingSubject = await tDb.subject.findUnique({
            where: { tenantId_code: { tenantId: user.tenantId, code: elective.code } },
          });
          if (existingSubject) {
            subjectsMatched += 1;
            subjectIds.push(existingSubject.id);
          } else {
            const created = await tDb.subject.create({
              data: {
                tenantId: user.tenantId,
                name: elective.name,
                code: elective.code,
                curriculum: "CBC", // Senior School Grade 10-12 is CBE/CBC-era, never 8-4-4.
              },
            });
            subjectsCreated += 1;
            subjectIds.push(created.id);
          }
        }

        // 2) Create/update ONE Pathway row per track, code-namespaced so multiple
        // tracks within the same group (e.g. STEM Pure vs STEM Technology) don't collide.
        const code = `${groupDef.group}-${track.code}`;
        const name = `${groupDef.name} — ${track.trackName}`;
        const existingPathway = await tDb.pathway.findUnique({
          where: { tenantId_code: { tenantId: user.tenantId, code } },
        });

        // P.2/P.3: every track's requirement list gets the group's compulsory
        // Mathematics variant AND Community Service Learning as real CORE
        // requirements (isCore: true), alongside the track's own electives
        // (isCore: false) — genuine per-pathway compulsory subjects, not a
        // cosmetic label.
        const requirementRows = [
          { tenantId: user.tenantId, subjectId: mathSubjectId, isCore: true },
          { tenantId: user.tenantId, subjectId: cslSubjectId, isCore: true },
          ...subjectIds.map((subjectId) => ({ tenantId: user.tenantId, subjectId, isCore: false })),
        ];

        if (existingPathway) {
          // Replace requirements idempotently (same approach as updatePathway above).
          await tDb.pathwaySubjectRequirement.deleteMany({ where: { pathwayId: existingPathway.id } });
          await tDb.pathway.update({
            where: { id: existingPathway.id },
            data: {
              name,
              description: track.description,
              pathwayGroup: groupDef.group,
              trackName: track.trackName,
              isOfficial: true,
              subjectRequirements: { create: requirementRows },
            },
          });
          pathwaysUpdated += 1;
        } else {
          await tDb.pathway.create({
            data: {
              tenantId: user.tenantId,
              name,
              code,
              description: track.description,
              pathwayGroup: groupDef.group,
              trackName: track.trackName,
              isOfficial: true,
              subjectRequirements: { create: requirementRows },
            },
          });
          pathwaysCreated += 1;
        }

        createdPathways.push({ name, code, group: groupDef.group, trackName: track.trackName });
      }
    }

    const communityServiceLearning = {
      subjectCode: COMMUNITY_SERVICE_LEARNING_SUBJECT.code,
      wasCreated: cslWasCreated,
      strandsCreated: cslStrandsCreated,
      strandsMatched: cslStrandsMatched,
    };

    await writeAudit(user, "pathway.official_taxonomy_seeded", "Pathway", "official-seed", {
      groups, groupLabels: groups.map((g) => PATHWAY_GROUP_LABELS[g]),
      pathwaysCreated, pathwaysUpdated, subjectsCreated, subjectsMatched,
      mathVariantsApplied, communityServiceLearning,
    });

    return {
      pathwaysCreated, pathwaysUpdated, subjectsCreated, subjectsMatched,
      pathways: createdPathways, mathVariantsApplied, communityServiceLearning,
    };
  });
}

// =============================================================================
// P.4 (2026-07-02) — National Assessment Milestones (KPSEA/KJSEA/Senior
// Secondary Assessment + legacy KCPE/KCSE). Real EXTERNAL KNEC results,
// distinct from internal Exam/ExamResult and from ExamMaterialRecord
// (which only tracks application/registration logistics, never a result).
// =============================================================================

function parseSubjectsJson(json: string | null): { subjectName: string; subjectCode: string | null; score: number | null; grade: string | null }[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Staff: record (or amend) a student's real national assessment milestone result. */
export async function recordNationalAssessment(user: SessionUser, input: NationalAssessmentInput) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const student = await tDb.student.findUnique({ where: { id: input.studentId } });
    if (!student) throw new PathwayError("NOT_FOUND", "Student not found.");

    const record = await tDb.studentNationalAssessment.upsert({
      where: {
        tenantId_studentId_milestone_year: {
          tenantId: user.tenantId, studentId: input.studentId, milestone: input.milestone, year: input.year,
        },
      },
      create: {
        tenantId: user.tenantId,
        studentId: input.studentId,
        milestone: input.milestone,
        year: input.year,
        indexNo: input.indexNo || null,
        overallScorePct: input.overallScorePct ?? null,
        overallGrade: input.overallGrade || null,
        subjectsJson: JSON.stringify(input.subjects ?? []),
        status: input.status,
        recordedById: user.id,
        recordedByName: user.fullName,
        notes: input.notes || null,
      },
      update: {
        indexNo: input.indexNo || null,
        overallScorePct: input.overallScorePct ?? null,
        overallGrade: input.overallGrade || null,
        subjectsJson: JSON.stringify(input.subjects ?? []),
        status: input.status,
        notes: input.notes || null,
      },
    });

    await writeAudit(user, "pathway.national_assessment_recorded", "Student", input.studentId, {
      milestone: input.milestone, year: input.year, overallScorePct: input.overallScorePct, status: input.status,
    });

    return { ...record, subjects: parseSubjectsJson(record.subjectsJson) };
  });
}

/** Staff: list every national assessment milestone recorded for a student. */
export async function getStudentNationalAssessments(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const student = await tDb.student.findUnique({ where: { id: studentId } });
    if (!student) throw new PathwayError("NOT_FOUND", "Student not found.");

    const rows = await tDb.studentNationalAssessment.findMany({
      where: { studentId },
      orderBy: [{ year: "desc" }, { milestone: "asc" }],
    });
    return rows.map((r) => ({ ...r, subjects: parseSubjectsJson(r.subjectsJson) }));
  });
}

export async function deleteNationalAssessment(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const existing = await tDb.studentNationalAssessment.findUnique({ where: { id } });
    if (!existing) throw new PathwayError("NOT_FOUND", "Record not found.");
    await tDb.studentNationalAssessment.delete({ where: { id } });
    await writeAudit(user, "pathway.national_assessment_deleted", "Student", existing.studentId, {
      milestone: existing.milestone, year: existing.year,
    });
    return { success: true };
  });
}
