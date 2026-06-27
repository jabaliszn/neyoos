/**
 * PART J.2 — Curriculum Engine service.
 *
 * WHAT: Real Prisma-backed backend logic for configurable curricula, education
 * levels, grade bands and learning areas. This extends existing B.4/B.5/B.6
 * academic data instead of replacing it.
 *
 * WHY: NEYO School OS must become a future-proof Education OS. CBC, 8-4-4,
 * future Kenya curriculum changes, Cambridge and custom frameworks should be
 * tenant data, not hardcoded app branches.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import {
  curriculumSchema,
  curriculumUpdateSchema,
  educationLevelSchema,
  educationLevelUpdateSchema,
  gradeBandSchema,
  gradeBandUpdateSchema,
  learningAreaSchema,
  learningAreaUpdateSchema,
  curriculumMappingsSchema,
  userCanManageCurriculum,
  userCanReadCurriculum,
  type CurriculumInput,
  type CurriculumUpdateInput,
  type EducationLevelInput,
  type EducationLevelUpdateInput,
  type GradeBandInput,
  type GradeBandUpdateInput,
  type LearningAreaInput,
  type LearningAreaUpdateInput,
  type CurriculumMappingsInput,
} from "@/lib/validations/curriculum";

export class CurriculumError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "CurriculumError";
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

function assertCanRead(user: SessionUser) {
  if (!userCanReadCurriculum(user)) {
    throw new CurriculumError("FORBIDDEN", "You do not have permission to view curriculum setup.");
  }
}

function assertCanManage(user: SessionUser) {
  if (!userCanManageCurriculum(user)) {
    throw new CurriculumError("FORBIDDEN", "Only academics leadership or school settings managers can change curriculum setup.");
  }
}

async function requireCurriculum(id: string) {
  const row = await tenantDb().curriculum.findUnique({ where: { id } });
  if (!row) throw new CurriculumError("NOT_FOUND", "Curriculum not found.");
  return row;
}

async function requireEducationLevel(id: string) {
  const row = await tenantDb().educationLevel.findUnique({ where: { id } });
  if (!row) throw new CurriculumError("NOT_FOUND", "Education level not found.");
  return row;
}

async function requireGradeBand(id: string) {
  const row = await tenantDb().gradeBand.findUnique({ where: { id } });
  if (!row) throw new CurriculumError("NOT_FOUND", "Grade band not found.");
  return row;
}

async function requireLearningArea(id: string) {
  const row = await tenantDb().learningArea.findUnique({ where: { id } });
  if (!row) throw new CurriculumError("NOT_FOUND", "Learning area not found.");
  return row;
}

async function assertCurriculumExists(id?: string) {
  if (!id) return null;
  return requireCurriculum(id);
}

async function assertNoCurriculumDuplicate(name: string, activeVersion: string, ignoreId?: string) {
  const duplicate = await tenantDb().curriculum.findFirst({ where: { name, activeVersion } });
  if (duplicate && duplicate.id !== ignoreId) {
    throw new CurriculumError("DUPLICATE", `Curriculum "${name}" version "${activeVersion}" already exists.`);
  }
}

async function assertNoLevelDuplicate(curriculumId: string, name: string, ignoreId?: string) {
  const duplicate = await tenantDb().educationLevel.findFirst({ where: { curriculumId, name } });
  if (duplicate && duplicate.id !== ignoreId) {
    throw new CurriculumError("DUPLICATE", `Education level "${name}" already exists in this curriculum.`);
  }
}

async function assertNoGradeDuplicate(curriculumId: string, name: string, ignoreId?: string) {
  const duplicate = await tenantDb().gradeBand.findFirst({ where: { curriculumId, name } });
  if (duplicate && duplicate.id !== ignoreId) {
    throw new CurriculumError("DUPLICATE", `Grade band "${name}" already exists in this curriculum.`);
  }
}

async function assertNoLearningAreaDuplicate(curriculumId: string, code: string, ignoreId?: string) {
  const duplicate = await tenantDb().learningArea.findFirst({ where: { curriculumId, code } });
  if (duplicate && duplicate.id !== ignoreId) {
    throw new CurriculumError("DUPLICATE", `Learning area code "${code}" already exists in this curriculum.`);
  }
}

export async function curriculumBoard(user: SessionUser) {
  assertCanRead(user);
  return withTenant(user.tenantId, async () => {
    const scoped = tenantDb();
    const [curricula, subjects, classes, terms, strands] = await Promise.all([
      scoped.curriculum.findMany({
        orderBy: [{ isActive: "desc" }, { name: "asc" }, { activeVersion: "desc" }],
        include: {
          educationLevels: { orderBy: [{ sequence: "asc" }, { name: "asc" }] },
          gradeBands: { orderBy: [{ sequence: "asc" }, { name: "asc" }] },
          learningAreas: { orderBy: [{ name: "asc" }] },
        },
      }),
      scoped.subject.findMany({
        where: { archived: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true, curriculum: true, curriculumId: true, learningAreaId: true },
      }),
      scoped.schoolClass.findMany({
        where: { archived: false },
        orderBy: [{ level: "asc" }, { stream: "asc" }],
        select: { id: true, level: true, stream: true, curriculum: true, curriculumId: true, gradeBandId: true },
      }),
      scoped.academicTerm.findMany({
        orderBy: [{ year: "desc" }, { term: "asc" }],
        select: { id: true, year: true, term: true, startDate: true, endDate: true, current: true, curriculumId: true },
      }),
      scoped.cbcStrand.findMany({
        orderBy: { name: "asc" },
        select: { id: true, subjectId: true, name: true, learningAreaId: true },
      }),
    ]);

    return {
      canManage: userCanManageCurriculum(user),
      curricula,
      mappings: { subjects, classes, terms, strands },
      summary: {
        curricula: curricula.length,
        educationLevels: curricula.reduce((sum, c) => sum + c.educationLevels.length, 0),
        gradeBands: curricula.reduce((sum, c) => sum + c.gradeBands.length, 0),
        learningAreas: curricula.reduce((sum, c) => sum + c.learningAreas.length, 0),
        unmappedSubjects: subjects.filter((s) => !s.curriculumId || !s.learningAreaId).length,
        unmappedClasses: classes.filter((c) => !c.curriculumId || !c.gradeBandId).length,
        unmappedTerms: terms.filter((t) => !t.curriculumId).length,
      },
    };
  });
}

export async function createCurriculum(user: SessionUser, input: CurriculumInput) {
  assertCanManage(user);
  const parsed = curriculumSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    await assertNoCurriculumDuplicate(parsed.name, parsed.activeVersion);
    const row = await tenantDb().curriculum.create({
      data: {
        tenantId: user.tenantId,
        name: parsed.name,
        country: parsed.country,
        context: parsed.context ?? null,
        activeVersion: parsed.activeVersion,
        effectiveFrom: parsed.effectiveFrom ?? null,
        effectiveTo: parsed.effectiveTo ?? null,
        isActive: parsed.isActive,
        notes: parsed.notes ?? null,
      },
    });
    await audit(user, "curriculum.created", "curriculum", row.id, { name: row.name, activeVersion: row.activeVersion });
    return row;
  });
}

export async function updateCurriculum(user: SessionUser, input: CurriculumUpdateInput) {
  assertCanManage(user);
  const parsed = curriculumUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await requireCurriculum(parsed.id);
    const nextName = parsed.name ?? existing.name;
    const nextVersion = parsed.activeVersion ?? existing.activeVersion;
    await assertNoCurriculumDuplicate(nextName, nextVersion, existing.id);
    const row = await tenantDb().curriculum.update({
      where: { id: existing.id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.country !== undefined ? { country: parsed.country } : {}),
        ...(parsed.context !== undefined ? { context: parsed.context ?? null } : {}),
        ...(parsed.activeVersion !== undefined ? { activeVersion: parsed.activeVersion } : {}),
        ...(parsed.effectiveFrom !== undefined ? { effectiveFrom: parsed.effectiveFrom ?? null } : {}),
        ...(parsed.effectiveTo !== undefined ? { effectiveTo: parsed.effectiveTo ?? null } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes ?? null } : {}),
      },
    });
    await audit(user, "curriculum.updated", "curriculum", row.id, { name: row.name, activeVersion: row.activeVersion });
    return row;
  });
}

export async function createEducationLevel(user: SessionUser, input: EducationLevelInput) {
  assertCanManage(user);
  const parsed = educationLevelSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    await requireCurriculum(parsed.curriculumId);
    await assertNoLevelDuplicate(parsed.curriculumId, parsed.name);
    const row = await tenantDb().educationLevel.create({
      data: {
        tenantId: user.tenantId,
        curriculumId: parsed.curriculumId,
        name: parsed.name,
        levelKey: parsed.levelKey,
        sequence: parsed.sequence,
        description: parsed.description ?? null,
      },
    });
    await audit(user, "curriculum.level_created", "educationLevel", row.id, { name: row.name, curriculumId: row.curriculumId });
    return row;
  });
}

export async function updateEducationLevel(user: SessionUser, input: EducationLevelUpdateInput) {
  assertCanManage(user);
  const parsed = educationLevelUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await requireEducationLevel(parsed.id);
    const nextCurriculumId = parsed.curriculumId ?? existing.curriculumId;
    const nextName = parsed.name ?? existing.name;
    await requireCurriculum(nextCurriculumId);
    await assertNoLevelDuplicate(nextCurriculumId, nextName, existing.id);
    const row = await tenantDb().educationLevel.update({
      where: { id: existing.id },
      data: {
        ...(parsed.curriculumId !== undefined ? { curriculumId: parsed.curriculumId } : {}),
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.levelKey !== undefined ? { levelKey: parsed.levelKey } : {}),
        ...(parsed.sequence !== undefined ? { sequence: parsed.sequence } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
      },
    });
    await audit(user, "curriculum.level_updated", "educationLevel", row.id, { name: row.name, curriculumId: row.curriculumId });
    return row;
  });
}

export async function createGradeBand(user: SessionUser, input: GradeBandInput) {
  assertCanManage(user);
  const parsed = gradeBandSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    await requireCurriculum(parsed.curriculumId);
    if (parsed.educationLevelId) {
      const level = await requireEducationLevel(parsed.educationLevelId);
      if (level.curriculumId !== parsed.curriculumId) {
        throw new CurriculumError("INVALID", "The selected education level belongs to a different curriculum.");
      }
    }
    await assertNoGradeDuplicate(parsed.curriculumId, parsed.name);
    const row = await tenantDb().gradeBand.create({
      data: {
        tenantId: user.tenantId,
        curriculumId: parsed.curriculumId,
        educationLevelId: parsed.educationLevelId ?? null,
        name: parsed.name,
        shortName: parsed.shortName ?? null,
        sequence: parsed.sequence,
        entryAge: parsed.entryAge ?? null,
        exitAge: parsed.exitAge ?? null,
      },
    });
    await audit(user, "curriculum.grade_band_created", "gradeBand", row.id, { name: row.name, curriculumId: row.curriculumId });
    return row;
  });
}

export async function updateGradeBand(user: SessionUser, input: GradeBandUpdateInput) {
  assertCanManage(user);
  const parsed = gradeBandUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await requireGradeBand(parsed.id);
    const nextCurriculumId = parsed.curriculumId ?? existing.curriculumId;
    const nextName = parsed.name ?? existing.name;
    await requireCurriculum(nextCurriculumId);
    if (parsed.educationLevelId) {
      const level = await requireEducationLevel(parsed.educationLevelId);
      if (level.curriculumId !== nextCurriculumId) {
        throw new CurriculumError("INVALID", "The selected education level belongs to a different curriculum.");
      }
    }
    await assertNoGradeDuplicate(nextCurriculumId, nextName, existing.id);
    const row = await tenantDb().gradeBand.update({
      where: { id: existing.id },
      data: {
        ...(parsed.curriculumId !== undefined ? { curriculumId: parsed.curriculumId } : {}),
        ...(parsed.educationLevelId !== undefined ? { educationLevelId: parsed.educationLevelId ?? null } : {}),
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.shortName !== undefined ? { shortName: parsed.shortName ?? null } : {}),
        ...(parsed.sequence !== undefined ? { sequence: parsed.sequence } : {}),
        ...(parsed.entryAge !== undefined ? { entryAge: parsed.entryAge ?? null } : {}),
        ...(parsed.exitAge !== undefined ? { exitAge: parsed.exitAge ?? null } : {}),
      },
    });
    await audit(user, "curriculum.grade_band_updated", "gradeBand", row.id, { name: row.name, curriculumId: row.curriculumId });
    return row;
  });
}

export async function createLearningArea(user: SessionUser, input: LearningAreaInput) {
  assertCanManage(user);
  const parsed = learningAreaSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    await requireCurriculum(parsed.curriculumId);
    await assertNoLearningAreaDuplicate(parsed.curriculumId, parsed.code);
    const row = await tenantDb().learningArea.create({
      data: {
        tenantId: user.tenantId,
        curriculumId: parsed.curriculumId,
        name: parsed.name,
        code: parsed.code,
        description: parsed.description ?? null,
      },
    });
    await audit(user, "curriculum.learning_area_created", "learningArea", row.id, { name: row.name, code: row.code, curriculumId: row.curriculumId });
    return row;
  });
}

export async function updateLearningArea(user: SessionUser, input: LearningAreaUpdateInput) {
  assertCanManage(user);
  const parsed = learningAreaUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await requireLearningArea(parsed.id);
    const nextCurriculumId = parsed.curriculumId ?? existing.curriculumId;
    const nextCode = parsed.code ?? existing.code;
    await requireCurriculum(nextCurriculumId);
    await assertNoLearningAreaDuplicate(nextCurriculumId, nextCode, existing.id);
    const row = await tenantDb().learningArea.update({
      where: { id: existing.id },
      data: {
        ...(parsed.curriculumId !== undefined ? { curriculumId: parsed.curriculumId } : {}),
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.code !== undefined ? { code: parsed.code } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
      },
    });
    await audit(user, "curriculum.learning_area_updated", "learningArea", row.id, { name: row.name, code: row.code, curriculumId: row.curriculumId });
    return row;
  });
}

async function resolveSubjectMapping(input: { curriculumId?: string; learningAreaId?: string }) {
  const learningArea = input.learningAreaId ? await requireLearningArea(input.learningAreaId) : null;
  const curriculum = input.curriculumId ? await requireCurriculum(input.curriculumId) : null;
  const curriculumId = curriculum?.id ?? learningArea?.curriculumId ?? null;
  if (learningArea && curriculum && learningArea.curriculumId !== curriculum.id) {
    throw new CurriculumError("INVALID", "The selected learning area belongs to a different curriculum.");
  }
  return { curriculumId, learningAreaId: learningArea?.id ?? null };
}

async function resolveClassMapping(input: { curriculumId?: string; gradeBandId?: string }) {
  const gradeBand = input.gradeBandId ? await requireGradeBand(input.gradeBandId) : null;
  const curriculum = input.curriculumId ? await requireCurriculum(input.curriculumId) : null;
  const curriculumId = curriculum?.id ?? gradeBand?.curriculumId ?? null;
  if (gradeBand && curriculum && gradeBand.curriculumId !== curriculum.id) {
    throw new CurriculumError("INVALID", "The selected grade band belongs to a different curriculum.");
  }
  return { curriculumId, gradeBandId: gradeBand?.id ?? null };
}

export async function mapExistingCurriculumRecords(user: SessionUser, input: CurriculumMappingsInput) {
  assertCanManage(user);
  const parsed = curriculumMappingsSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const scoped = tenantDb();
    let subjects = 0;
    let classes = 0;
    let terms = 0;
    let strands = 0;

    for (const item of parsed.subjects) {
      const subject = await scoped.subject.findUnique({ where: { id: item.subjectId }, select: { id: true } });
      if (!subject) throw new CurriculumError("NOT_FOUND", "Subject not found while mapping curriculum.");
      const resolved = await resolveSubjectMapping(item);
      await scoped.subject.update({ where: { id: subject.id }, data: resolved });
      subjects++;
    }

    for (const item of parsed.classes) {
      const cls = await scoped.schoolClass.findUnique({ where: { id: item.classId }, select: { id: true } });
      if (!cls) throw new CurriculumError("NOT_FOUND", "Class not found while mapping curriculum.");
      const resolved = await resolveClassMapping(item);
      await scoped.schoolClass.update({ where: { id: cls.id }, data: resolved });
      classes++;
    }

    for (const item of parsed.terms) {
      const term = await scoped.academicTerm.findUnique({ where: { id: item.termId }, select: { id: true } });
      if (!term) throw new CurriculumError("NOT_FOUND", "Academic term not found while mapping curriculum.");
      await assertCurriculumExists(item.curriculumId);
      await scoped.academicTerm.update({ where: { id: term.id }, data: { curriculumId: item.curriculumId ?? null } });
      terms++;
    }

    for (const item of parsed.strands) {
      const strand = await scoped.cbcStrand.findUnique({ where: { id: item.strandId }, select: { id: true } });
      if (!strand) throw new CurriculumError("NOT_FOUND", "CBC strand not found while mapping learning area.");
      await (item.learningAreaId ? requireLearningArea(item.learningAreaId) : Promise.resolve(null));
      await scoped.cbcStrand.update({ where: { id: strand.id }, data: { learningAreaId: item.learningAreaId ?? null } });
      strands++;
    }

    const result = { subjects, classes, terms, strands };
    await audit(user, "curriculum.mappings_updated", "curriculum", user.tenantId, result);
    return result;
  });
}

function curriculumDisplayName(key: string) {
  if (key === "CBC") return "CBC Kenya";
  if (key === "8-4-4") return "8-4-4 Legacy";
  if (key === "BOTH") return "Combined Curriculum";
  return `${key} Curriculum`;
}

function curriculumContext(key: string) {
  if (key === "CBC") return "Competency-based Kenyan curriculum";
  if (key === "8-4-4") return "Kenyan legacy Forms pathway";
  if (key === "BOTH") return "School-defined combined pathway";
  return "School-defined pathway";
}

function levelKeyForClassLevel(level: string) {
  const lower = level.toLowerCase();
  if (lower.includes("pp")) return { levelName: "Pre-primary", levelKey: "preschool", sequence: 1 };
  if (lower.includes("grade")) {
    const n = Number(lower.match(/grade\s*(\d+)/)?.[1] ?? 0);
    if (n >= 10) return { levelName: "Senior School", levelKey: "senior", sequence: 4 };
    if (n >= 7) return { levelName: "Junior School", levelKey: "junior", sequence: 3 };
    return { levelName: "Primary", levelKey: "primary", sequence: 2 };
  }
  if (lower.includes("form")) return { levelName: "Forms", levelKey: "forms", sequence: 3 };
  return { levelName: "Custom Levels", levelKey: "custom", sequence: 99 };
}

function gradeSequence(level: string) {
  const match = level.match(/(\d+)/);
  return match ? Number(match[1]) : 99;
}

function shortGradeName(level: string) {
  const lower = level.toLowerCase();
  const n = level.match(/(\d+)/)?.[1];
  if (!n) return level.slice(0, 8).toUpperCase();
  if (lower.includes("form")) return `F${n}`;
  if (lower.includes("grade")) return `G${n}`;
  if (lower.includes("year")) return `Y${n}`;
  return level.slice(0, 8).toUpperCase();
}

function cleanLearningAreaName(name: string) {
  return name.replace(/\s*\(CBC\)\s*$/i, "").trim();
}

function learningAreaCode(subject: { code: string; curriculum: string }) {
  if (subject.curriculum === "CBC" && subject.code.endsWith("C")) return subject.code.slice(0, -1) || subject.code;
  return subject.code;
}

/**
 * J.2 migration assistant — converts existing B.4/B.6 academic rows into the
 * configurable curriculum engine without duplicating those existing records.
 * It is idempotent and safe to run repeatedly from seed, API or UI.
 */
export async function runCurriculumMigrationAssistant(user: SessionUser) {
  assertCanManage(user);
  return withTenant(user.tenantId, async () => {
    const scoped = tenantDb();
    const [subjects, classes, terms, strands] = await Promise.all([
      scoped.subject.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
      scoped.schoolClass.findMany({ where: { archived: false }, orderBy: [{ level: "asc" }, { stream: "asc" }] }),
      scoped.academicTerm.findMany({ orderBy: [{ year: "desc" }, { term: "asc" }] }),
      scoped.cbcStrand.findMany({ orderBy: { name: "asc" } }),
    ]);

    const version = String(terms.find((t) => t.current)?.year ?? new Date().getFullYear());
    const curriculumKeys = new Set<string>();
    for (const subject of subjects) curriculumKeys.add(subject.curriculum || "custom");
    for (const cls of classes) curriculumKeys.add(cls.curriculum || "custom");
    if (curriculumKeys.size === 0) curriculumKeys.add("custom");

    const curriculaByKey = new Map<string, Awaited<ReturnType<typeof db.curriculum.upsert>>>();
    let createdCurricula = 0;
    for (const key of Array.from(curriculumKeys).sort()) {
      const name = curriculumDisplayName(key);
      const existing = await scoped.curriculum.findFirst({ where: { name, activeVersion: version } });
      const curriculum = await db.curriculum.upsert({
        where: { tenantId_name_activeVersion: { tenantId: user.tenantId, name, activeVersion: version } },
        create: {
          tenantId: user.tenantId,
          name,
          country: "Kenya",
          context: curriculumContext(key),
          activeVersion: version,
          effectiveFrom: terms.find((t) => t.current)?.startDate ?? null,
          isActive: true,
          notes: "Created by NEYO curriculum migration assistant from existing school records.",
        },
        update: { isActive: true },
      });
      if (!existing) createdCurricula++;
      curriculaByKey.set(key, curriculum);
    }

    let createdLevels = 0;
    let createdGradeBands = 0;
    let createdLearningAreas = 0;
    let mappedSubjects = 0;
    let mappedClasses = 0;
    let mappedTerms = 0;
    let mappedStrands = 0;

    const levelsByKey = new Map<string, { id: string; curriculumId: string }>();
    async function ensureLevel(curriculumId: string, level: string) {
      const meta = levelKeyForClassLevel(level);
      const mapKey = `${curriculumId}:${meta.levelName}`;
      const found = levelsByKey.get(mapKey);
      if (found) return found;
      const existing = await scoped.educationLevel.findFirst({ where: { curriculumId, name: meta.levelName } });
      const row = await db.educationLevel.upsert({
        where: { tenantId_curriculumId_name: { tenantId: user.tenantId, curriculumId, name: meta.levelName } },
        create: { tenantId: user.tenantId, curriculumId, name: meta.levelName, levelKey: meta.levelKey, sequence: meta.sequence, description: `Auto-created from class level ${level}.` },
        update: { levelKey: meta.levelKey, sequence: meta.sequence },
      });
      if (!existing) createdLevels++;
      const value = { id: row.id, curriculumId: row.curriculumId };
      levelsByKey.set(mapKey, value);
      return value;
    }

    const gradeBandsByKey = new Map<string, { id: string; curriculumId: string }>();
    async function ensureGradeBand(curriculumId: string, level: string) {
      const mapKey = `${curriculumId}:${level}`;
      const found = gradeBandsByKey.get(mapKey);
      if (found) return found;
      const levelRow = await ensureLevel(curriculumId, level);
      const existing = await scoped.gradeBand.findFirst({ where: { curriculumId, name: level } });
      const row = await db.gradeBand.upsert({
        where: { tenantId_curriculumId_name: { tenantId: user.tenantId, curriculumId, name: level } },
        create: { tenantId: user.tenantId, curriculumId, educationLevelId: levelRow.id, name: level, shortName: shortGradeName(level), sequence: gradeSequence(level) },
        update: { educationLevelId: levelRow.id, shortName: shortGradeName(level), sequence: gradeSequence(level) },
      });
      if (!existing) createdGradeBands++;
      const value = { id: row.id, curriculumId: row.curriculumId };
      gradeBandsByKey.set(mapKey, value);
      return value;
    }

    const learningAreasByKey = new Map<string, { id: string; curriculumId: string }>();
    async function ensureLearningArea(curriculumId: string, subject: { name: string; code: string; curriculum: string }) {
      const code = learningAreaCode(subject).toUpperCase();
      const mapKey = `${curriculumId}:${code}`;
      const found = learningAreasByKey.get(mapKey);
      if (found) return found;
      const existing = await scoped.learningArea.findFirst({ where: { curriculumId, code } });
      const row = await db.learningArea.upsert({
        where: { tenantId_curriculumId_code: { tenantId: user.tenantId, curriculumId, code } },
        create: { tenantId: user.tenantId, curriculumId, code, name: cleanLearningAreaName(subject.name), description: `Auto-created from existing subject ${subject.code}.` },
        update: { name: cleanLearningAreaName(subject.name) },
      });
      if (!existing) createdLearningAreas++;
      const value = { id: row.id, curriculumId: row.curriculumId };
      learningAreasByKey.set(mapKey, value);
      return value;
    }

    for (const subject of subjects) {
      const curriculum = curriculaByKey.get(subject.curriculum || "custom") ?? curriculaByKey.values().next().value;
      if (!curriculum) continue;
      const area = await ensureLearningArea(curriculum.id, subject);
      await scoped.subject.update({ where: { id: subject.id }, data: { curriculumId: curriculum.id, learningAreaId: area.id } });
      mappedSubjects++;
    }

    for (const cls of classes) {
      const curriculum = curriculaByKey.get(cls.curriculum || "custom") ?? curriculaByKey.values().next().value;
      if (!curriculum) continue;
      const gradeBand = await ensureGradeBand(curriculum.id, cls.level);
      await scoped.schoolClass.update({ where: { id: cls.id }, data: { curriculumId: curriculum.id, gradeBandId: gradeBand.id } });
      mappedClasses++;
    }

    const classCurriculumCounts = new Map<string, number>();
    for (const cls of classes) classCurriculumCounts.set(cls.curriculum, (classCurriculumCounts.get(cls.curriculum) ?? 0) + 1);
    const mainCurriculumKey = Array.from(classCurriculumCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? Array.from(curriculumKeys)[0];
    const mainCurriculum = curriculaByKey.get(mainCurriculumKey) ?? curriculaByKey.values().next().value;
    if (mainCurriculum) {
      for (const term of terms) {
        await scoped.academicTerm.update({ where: { id: term.id }, data: { curriculumId: mainCurriculum.id } });
        mappedTerms++;
      }
    }

    const subjectArea = new Map((await scoped.subject.findMany({ select: { id: true, learningAreaId: true } })).map((s) => [s.id, s.learningAreaId]));
    for (const strand of strands) {
      const learningAreaId = subjectArea.get(strand.subjectId);
      if (!learningAreaId) continue;
      await scoped.cbcStrand.update({ where: { id: strand.id }, data: { learningAreaId } });
      mappedStrands++;
    }

    const result = {
      createdCurricula,
      createdLevels,
      createdGradeBands,
      createdLearningAreas,
      mappedSubjects,
      mappedClasses,
      mappedTerms,
      mappedStrands,
    };
    await audit(user, "curriculum.migration_assistant_run", "curriculum", user.tenantId, result);
    return result;
  });
}
