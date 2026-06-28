/**
 * PART J.5 — Rubrics & Evidence backend service.
 *
 * Provides real Prisma queries for configurable rubrics, level management,
 * attaching rubrics to flexible assessments/competencies, scoring with rubrics,
 * and encrypted evidence file attachment.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import {
  rubricSchema,
  rubricUpdateSchema,
  attachRubricSchema,
  scoreWithRubricSchema,
  attachRubricEvidenceSchema,
  userCanReadRubrics,
  userCanManageRubrics,
  userCanScoreWithRubrics,
  type RubricInput,
  type RubricUpdateInput,
  type AttachRubricInput,
  type ScoreWithRubricInput,
  type AttachRubricEvidenceInput,
} from "@/lib/validations/rubric";

export class RubricError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "DUPLICATE" | "INVALID", message: string) {
    super(message);
    this.name = "RubricError";
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
  if (!userCanReadRubrics(user)) throw new RubricError("FORBIDDEN", "You do not have permission to view rubrics.");
}
function assertManage(user: SessionUser) {
  if (!userCanManageRubrics(user)) throw new RubricError("FORBIDDEN", "Only academic leadership can manage rubric definitions.");
}
function assertScore(user: SessionUser) {
  if (!userCanScoreWithRubrics(user)) throw new RubricError("FORBIDDEN", "Only teachers and academic leaders can score assessments or attach evidence.");
}

const DEFAULT_CBC_RUBRIC = {
  name: "CBC Comprehensive Rubric",
  description: "Standard 4-level evaluation rubric for CBC subjects and formative projects.",
  category: "CBC",
  levels: [
    { level: 4, code: "EE", label: "Exceeding Expectation", descriptor: "Learner correctly performs the task with exceptional creativity and deep mastery.", points: 100 },
    { level: 3, code: "ME", label: "Meeting Expectation", descriptor: "Learner correctly performs the task following instructions independently.", points: 75 },
    { level: 2, code: "AE", label: "Approaching Expectation", descriptor: "Learner attempts the task but requires guidance to complete key steps.", points: 50 },
    { level: 1, code: "BE", label: "Below Expectation", descriptor: "Learner exhibits major difficulties in performing the task even with close guidance.", points: 25 },
  ],
};

const DEFAULT_PROJECT_RUBRIC = {
  name: "5-Level Project Rubric",
  description: "Evaluates project work, practicals and portfolios across 5 levels of mastery.",
  category: "PROJECT",
  levels: [
    { level: 5, code: "EXCELLENT", label: "Excellent mastery", descriptor: "Outstanding work demonstrating deep understanding and exceptional execution.", points: 100 },
    { level: 4, code: "GOOD", label: "Good mastery", descriptor: "Solid work meeting all key project requirements effectively.", points: 80 },
    { level: 3, code: "SATISFACTORY", label: "Satisfactory", descriptor: "Meets basic expectations but lacks depth or polish in key areas.", points: 60 },
    { level: 2, code: "PASS", label: "Pass", descriptor: "Barely meets passing criteria; significant improvement needed.", points: 40 },
    { level: 1, code: "NEEDS_WORK", label: "Needs Work", descriptor: "Does not meet passing criteria; requires complete revision.", points: 20 },
  ],
};

export async function ensureDefaultRubrics(user: SessionUser) {
  assertManage(user);
  return withTenant(user.tenantId, async () => {
    let created = 0;
    for (const preset of [DEFAULT_CBC_RUBRIC, DEFAULT_PROJECT_RUBRIC]) {
      const existing = await tenantDb().rubric.findFirst({ where: { name: preset.name } });
      if (!existing) {
        const row = await tenantDb().rubric.create({
          data: {
            name: preset.name,
            description: preset.description,
            category: preset.category,
            createdById: user.id,
            levels: {
              create: preset.levels.map((l) => ({ ...l, tenantId: user.tenantId })),
            },
          } as never,
        });
        await audit(user, "rubric.defaults_seeded", "rubric", row.id, { name: preset.name, levels: preset.levels.length });
        created++;
      }
    }
    return { seededCount: created };
  });
}

export async function rubricBoard(user: SessionUser) {
  assertRead(user);
  return withTenant(user.tenantId, async () => {
    const [activeRubrics, archivedRubrics] = await Promise.all([
      tenantDb().rubric.findMany({
        where: { isArchived: false },
        include: { levels: { orderBy: { level: "desc" } } },
        orderBy: { name: "asc" },
      }),
      tenantDb().rubric.findMany({
        where: { isArchived: true },
        include: { levels: { orderBy: { level: "desc" } } },
        orderBy: { name: "asc" },
      }),
    ]);
    return {
      canManage: userCanManageRubrics(user),
      canScore: userCanScoreWithRubrics(user),
      rubrics: activeRubrics,
      archivedRubrics,
      summary: {
        total: activeRubrics.length + archivedRubrics.length,
        active: activeRubrics.length,
        archived: archivedRubrics.length,
      },
    };
  });
}

export async function createRubric(user: SessionUser, input: RubricInput) {
  assertManage(user);
  const parsed = rubricSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().rubric.findFirst({ where: { name: parsed.name } });
    if (existing) throw new RubricError("DUPLICATE", "A rubric with this name already exists in your school.");

    const row = await tenantDb().rubric.create({
      data: {
        name: parsed.name,
        description: parsed.description ?? null,
        category: parsed.category,
        isArchived: parsed.isArchived,
        createdById: user.id,
        levels: {
          create: parsed.levels.map((l) => ({ ...l, tenantId: user.tenantId })),
        },
      } as never,
    });
    await audit(user, "rubric.created", "rubric", row.id, { name: row.name, category: row.category, levelsCount: parsed.levels.length });
    return row;
  });
}

export async function updateRubric(user: SessionUser, input: RubricUpdateInput) {
  assertManage(user);
  const parsed = rubricUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().rubric.findUnique({ where: { id: parsed.id } });
    if (!existing) throw new RubricError("NOT_FOUND", "Rubric not found.");

    if (parsed.name && parsed.name !== existing.name) {
      const dupe = await tenantDb().rubric.findFirst({ where: { name: parsed.name } });
      if (dupe) throw new RubricError("DUPLICATE", "A rubric with this name already exists.");
    }

    if (parsed.levels) {
      await tenantDb().rubricLevel.deleteMany({ where: { rubricId: existing.id } });
    }

    const row = await tenantDb().rubric.update({
      where: { id: existing.id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
        ...(parsed.category !== undefined ? { category: parsed.category } : {}),
        ...(parsed.isArchived !== undefined ? { isArchived: parsed.isArchived } : {}),
        ...(parsed.levels !== undefined
          ? { levels: { create: parsed.levels.map((l) => ({ ...l, tenantId: user.tenantId })) } }
          : {}),
      } as never,
    });
    await audit(user, "rubric.updated", "rubric", row.id, { name: row.name, levelsUpdated: !!parsed.levels });
    return row;
  });
}

export async function archiveRubric(user: SessionUser, id: string, isArchived: boolean) {
  assertManage(user);
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().rubric.findUnique({ where: { id } });
    if (!existing) throw new RubricError("NOT_FOUND", "Rubric not found.");

    const row = await tenantDb().rubric.update({
      where: { id: existing.id },
      data: { isArchived } as never,
    });
    await audit(user, "rubric.archived", "rubric", row.id, { isArchived });
    return row;
  });
}

export async function attachRubric(user: SessionUser, input: AttachRubricInput) {
  assertManage(user);
  const parsed = attachRubricSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const rubric = await tenantDb().rubric.findUnique({ where: { id: parsed.rubricId } });
    if (!rubric) throw new RubricError("NOT_FOUND", "Rubric not found.");

    let targetName = "";
    if (parsed.targetType === "assessment_type") {
      const target = await tenantDb().assessmentType.findUnique({ where: { id: parsed.targetId } });
      if (!target) throw new RubricError("NOT_FOUND", "Assessment type not found.");
      await tenantDb().assessmentType.update({ where: { id: target.id }, data: { rubricId: rubric.id } as never });
      targetName = target.name;
    } else if (parsed.targetType === "assessment_plan") {
      const target = await tenantDb().assessmentPlan.findUnique({ where: { id: parsed.targetId } });
      if (!target) throw new RubricError("NOT_FOUND", "Assessment plan not found.");
      await tenantDb().assessmentPlan.update({ where: { id: target.id }, data: { rubricId: rubric.id } as never });
      targetName = target.title;
    } else if (parsed.targetType === "competency") {
      const target = await tenantDb().competency.findUnique({ where: { id: parsed.targetId } });
      if (!target) throw new RubricError("NOT_FOUND", "Competency not found.");
      await tenantDb().competency.update({ where: { id: target.id }, data: { rubricId: rubric.id } as never });
      targetName = target.name;
    }

    await audit(user, "rubric.attached", "rubric", rubric.id, { targetType: parsed.targetType, targetId: parsed.targetId, targetName });
    return { success: true, rubricId: rubric.id, targetType: parsed.targetType, targetId: parsed.targetId };
  });
}

export async function scoreWithRubric(user: SessionUser, input: ScoreWithRubricInput) {
  assertScore(user);
  const parsed = scoreWithRubricSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const rubric = await tenantDb().rubric.findUnique({
      where: { id: parsed.rubricId },
      include: { levels: true },
    });
    if (!rubric) throw new RubricError("NOT_FOUND", "Rubric not found.");

    const levelMatch = rubric.levels.find((l) => l.level === parsed.rubricLevel && l.code === parsed.rubricCode);
    if (!levelMatch) throw new RubricError("INVALID", `Rubric level ${parsed.rubricLevel} (${parsed.rubricCode}) does not exist in this rubric.`);

    const calculatedPoints = parsed.points ?? levelMatch.points ?? null;

    if (parsed.targetType === "assessment_record") {
      const record = await tenantDb().assessmentRecord.findUnique({ where: { id: parsed.targetId } });
      if (!record) throw new RubricError("NOT_FOUND", "Assessment record not found.");
      const updated = await tenantDb().assessmentRecord.update({
        where: { id: record.id },
        data: {
          rubricLevel: parsed.rubricLevel,
          rubricCode: parsed.rubricCode,
          scoreMarks: calculatedPoints !== null ? calculatedPoints : null,
          scorePct: calculatedPoints !== null ? Math.round(calculatedPoints) : null,
          narrative: parsed.narrative ?? null,
          status: "SCORED",
          rubricId: rubric.id,
          assessedById: user.id,
          assessedByName: user.fullName,
          assessedAt: new Date(),
        } as never,
      });
      await audit(user, "rubric.scored", "assessmentRecord", updated.id, { rubricId: rubric.id, level: parsed.rubricLevel, code: parsed.rubricCode });
      return updated;
    } else {
      const evidence = await tenantDb().competencyEvidence.findUnique({ where: { id: parsed.targetId } });
      if (!evidence) throw new RubricError("NOT_FOUND", "Competency evidence not found.");
      const updated = await tenantDb().competencyEvidence.update({
        where: { id: evidence.id },
        data: {
          level: parsed.rubricLevel,
          scorePct: calculatedPoints !== null ? Math.round(calculatedPoints) : null,
          narrative: parsed.narrative ?? null,
          rubricId: rubric.id,
          recordedById: user.id,
          recordedByName: user.fullName,
        } as never,
      });
      await audit(user, "rubric.scored", "competencyEvidence", updated.id, { rubricId: rubric.id, level: parsed.rubricLevel, code: parsed.rubricCode });
      return updated;
    }
  });
}

export async function attachEvidenceFile(user: SessionUser, input: AttachRubricEvidenceInput) {
  assertScore(user);
  const parsed = attachRubricEvidenceSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    // Ensure the file exists in the encrypted Storage Vault path
    const storedFile = await tenantDb().storedFile.findUnique({ where: { id: parsed.storedFileId } });
    if (!storedFile) throw new RubricError("NOT_FOUND", "Stored file reference not found in the encrypted Storage Vault.");

    if (parsed.targetType === "assessment_record") {
      const record = await tenantDb().assessmentRecord.findUnique({ where: { id: parsed.targetId } });
      if (!record) throw new RubricError("NOT_FOUND", "Assessment record not found.");
      const evidence = await tenantDb().assessmentEvidence.create({
        data: {
          tenantId: user.tenantId,
          recordId: record.id,
          storedFileId: storedFile.id,
          fileUrl: parsed.fileUrl,
          fileName: parsed.fileName,
          contentType: parsed.contentType ?? null,
          evidenceType: parsed.evidenceType,
          note: parsed.note ?? null,
          uploadedById: user.id,
          uploadedByName: user.fullName,
        } as never,
      });
      await audit(user, "rubric.evidence_attached", "assessmentEvidence", evidence.id, { recordId: record.id, storedFileId: storedFile.id });
      return evidence;
    } else {
      const compEvidence = await tenantDb().competencyEvidence.findUnique({ where: { id: parsed.targetId } });
      if (!compEvidence) throw new RubricError("NOT_FOUND", "Competency evidence not found.");
      const updated = await tenantDb().competencyEvidence.update({
        where: { id: compEvidence.id },
        data: {
          narrative: parsed.note ? `${compEvidence.narrative ?? ""} [Evidence: ${parsed.fileName} - ${parsed.note}]`.trim() : compEvidence.narrative,
          recordedById: user.id,
          recordedByName: user.fullName,
        } as never,
      });
      await audit(user, "rubric.evidence_attached", "competencyEvidence", updated.id, { storedFileId: storedFile.id });
      return updated;
    }
  });
}
