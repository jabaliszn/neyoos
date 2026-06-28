/**
 * PART J.6 — Skills Passport backend service.
 *
 * Provides real Prisma queries for the Skills Passport profile, aggregating
 * academic exams, J.4 competencies, and talent/leadership ratings without
 * duplicating underlying modules.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { scopeWhere } from "@/lib/services/student.service";
import { cbcLevel, grade844 } from "@/lib/validations/exams";
import {
  skillsPassportEntrySchema,
  userCanReadSkillsPassport,
  userCanRecordSkillsPassport,
  type SkillsPassportEntryInput,
} from "@/lib/validations/skills-passport";

export class SkillsPassportError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "INVALID", message: string) {
    super(message);
    this.name = "SkillsPassportError";
  }
}

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action,
      entityType,
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

function assertRead(user: SessionUser) {
  if (!userCanReadSkillsPassport(user)) throw new SkillsPassportError("FORBIDDEN", "You do not have permission to view the Skills Passport.");
}
function assertRecord(user: SessionUser) {
  if (!userCanRecordSkillsPassport(user)) throw new SkillsPassportError("FORBIDDEN", "Only teachers and academic leaders can record skill ratings.");
}

export async function getSkillsPassportProfile(user: SessionUser, studentId: string) {
  assertRead(user);
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({
      where: { AND: [{ id: studentId }, scope] },
      include: { schoolClass: true },
    });
    if (!student) throw new SkillsPassportError("NOT_FOUND", "Student not found or access forbidden by row scoping.");

    const isParentOrStudent = ["PARENT", "STUDENT"].includes(user.role);

    // 1. Academic Growth: Aggregate published exams and released flexible assessments
    const [examResults, assessmentRecords, competencyEvidence, skillEntries, subjects] = await Promise.all([
      tenantDb().examResult.findMany({
        where: {
          studentId,
          exam: isParentOrStudent ? { published: true } : {},
        },
        include: { exam: true },
        orderBy: { exam: { createdAt: "desc" } },
      }),
      tenantDb().assessmentRecord.findMany({
        where: {
          studentId,
          plan: isParentOrStudent ? { visibleToParents: true } : {},
        },
        include: { plan: { include: { assessmentType: true } } },
        orderBy: { createdAt: "desc" },
      }),
      // 2. Competency Growth: Aggregate J.4 competency evidence
      tenantDb().competencyEvidence.findMany({
        where: {
          studentId,
          ...(isParentOrStudent ? { approved: true, visibleToParents: true } : {}),
        },
        include: { competency: { include: { group: true } } },
        orderBy: { evidenceDate: "desc" },
      }),
      // 3. Talent & Leadership Growth: Aggregate J.6 skill passport entries
      tenantDb().skillsPassportEntry.findMany({
        where: { studentId },
        orderBy: { evidenceDate: "desc" },
      }),
      tenantDb().subject.findMany({}),
    ]);

    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

    // Group skill entries by skillArea to compute latest star rating and count
    const bySkillArea = new Map<string, typeof skillEntries>();
    for (const row of skillEntries) {
      bySkillArea.set(row.skillArea, [...(bySkillArea.get(row.skillArea) ?? []), row]);
    }

    return {
      canRecord: userCanRecordSkillsPassport(user),
      student: {
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        admissionNo: student.admissionNo,
        className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
        photoUrl: student.photoUrl,
      },
      academicGrowth: {
        exams: examResults.map((r) => ({
          examName: r.exam.name,
          subjectName: subjectMap.get(r.subjectId) ?? "General Subject",
          marks: r.marks,
          grade: r.exam.type === "CBC" ? cbcLevel(Math.round((r.marks / (r.exam.maxMarks || 100)) * 100)) : grade844(Math.round((r.marks / (r.exam.maxMarks || 100)) * 100)),
          term: r.exam.term,
          year: r.exam.year,
        })),
        flexibleAssessments: assessmentRecords.map((r) => ({
          planTitle: r.plan.title,
          typeName: r.plan.assessmentType.name,
          scoreMarks: r.scoreMarks,
          scorePct: r.scorePct,
          rubricLevel: r.rubricLevel,
          rubricCode: r.rubricCode,
          narrative: r.narrative,
          term: r.plan.term,
          year: r.plan.year,
        })),
      },
      competencyGrowth: competencyEvidence.map((e) => ({
        competencyName: e.competency.name,
        competencyCode: e.competency.code,
        groupName: e.competency.group?.name ?? "General",
        level: e.level,
        scorePct: e.scorePct,
        narrative: e.narrative,
        date: e.evidenceDate,
        recordedByName: e.recordedByName,
      })),
      talentAndLeadership: [...bySkillArea.entries()].map(([skillArea, rows]) => ({
        skillArea,
        latestRating: rows[0].ratingLevel,
        evidenceCount: rows.length,
        latestSource: rows[0].evidenceSource,
        latestNarrative: rows[0].narrative,
        latestDate: rows[0].evidenceDate,
        history: rows,
      })),
      summary: {
        academicPoints: examResults.length + assessmentRecords.length,
        competencyPoints: competencyEvidence.length,
        talentPoints: skillEntries.length,
        totalPoints: examResults.length + assessmentRecords.length + competencyEvidence.length + skillEntries.length,
      },
    };
  });
}

export async function recordSkillRating(user: SessionUser, input: SkillsPassportEntryInput) {
  assertRecord(user);
  const parsed = skillsPassportEntrySchema.parse(input);
  return withTenant(user.tenantId, async () => {
    // Verify student exists in scope
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({
      where: { AND: [{ id: parsed.studentId }, scope] },
    });
    if (!student) throw new SkillsPassportError("NOT_FOUND", "Student not found or access forbidden by row scoping.");

    const row = await tenantDb().skillsPassportEntry.create({
      data: {
        ...parsed,
        tenantId: user.tenantId,
        sourceId: parsed.sourceId ?? null,
        narrative: parsed.narrative ?? null,
        recordedById: user.id,
        recordedByName: user.fullName,
      } as never,
    });
    await audit(user, "skills_passport.rating_recorded", "skillsPassportEntry", row.id, { studentId: row.studentId, skillArea: row.skillArea, ratingLevel: row.ratingLevel });
    return row;
  });
}

export async function removeSkillRating(user: SessionUser, id: string) {
  assertRecord(user);
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().skillsPassportEntry.findUnique({ where: { id } });
    if (!existing) throw new SkillsPassportError("NOT_FOUND", "Skills passport entry not found.");

    const row = await tenantDb().skillsPassportEntry.delete({ where: { id: existing.id } });
    await audit(user, "skills_passport.rating_removed", "skillsPassportEntry", row.id, { studentId: row.studentId, skillArea: row.skillArea });
    return row;
  });
}
