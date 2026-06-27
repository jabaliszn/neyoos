/**
 * PART J.4 — Competency Framework service.
 *
 * Real Prisma-backed service for configurable competency groups, competencies,
 * learner evidence, summaries and heatmap foundations.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { scopeWhere } from "@/lib/services/student.service";
import { teacherClassIds } from "@/lib/services/teacher-portal.service";
import {
  competencyGroupSchema,
  competencyGroupUpdateSchema,
  competencySchema,
  competencyUpdateSchema,
  competencyEvidenceSchema,
  competencyEvidenceUpdateSchema,
  competencyEvidenceApprovalSchema,
  userCanReadCompetencies,
  userCanManageCompetencies,
  userCanRecordCompetencyEvidence,
  userCanApproveCompetencyEvidence,
  type CompetencyGroupInput,
  type CompetencyGroupUpdateInput,
  type CompetencyInput,
  type CompetencyUpdateInput,
  type CompetencyEvidenceInput,
  type CompetencyEvidenceUpdateInput,
  type CompetencyEvidenceApprovalInput,
} from "@/lib/validations/competency";

export class CompetencyError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "CompetencyError";
  }
}

const DEFAULT_GROUP = {
  name: "Core Competencies",
  code: "CORE",
  description: "Cross-curriculum learner growth competencies used across the school.",
  sequence: 1,
  active: true,
};

const DEFAULT_COMPETENCIES = [
  { name: "Communication", code: "COMMUNICATION", description: "Explains ideas clearly, listens actively and communicates respectfully.", sequence: 1 },
  { name: "Critical Thinking", code: "CRITICAL_THINKING", description: "Questions, reasons, compares evidence and makes thoughtful decisions.", sequence: 2 },
  { name: "Problem Solving", code: "PROBLEM_SOLVING", description: "Identifies problems, tests approaches and improves solutions.", sequence: 3 },
  { name: "Creativity", code: "CREATIVITY", description: "Generates original ideas and presents work in imaginative ways.", sequence: 4 },
  { name: "Citizenship", code: "CITIZENSHIP", description: "Acts responsibly, respects others and contributes to the community.", sequence: 5 },
  { name: "Digital Literacy", code: "DIGITAL_LITERACY", description: "Uses digital tools safely, responsibly and productively.", sequence: 6 },
  { name: "Learning to Learn", code: "LEARNING_TO_LEARN", description: "Reflects on progress, accepts feedback and improves learning habits.", sequence: 7 },
];

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
  if (!userCanReadCompetencies(user)) throw new CompetencyError("FORBIDDEN", "You do not have permission to view competencies.");
}
function assertManage(user: SessionUser) {
  if (!userCanManageCompetencies(user)) throw new CompetencyError("FORBIDDEN", "Only academic leadership can manage the competency framework.");
}
function assertRecord(user: SessionUser) {
  if (!userCanRecordCompetencyEvidence(user)) throw new CompetencyError("FORBIDDEN", "Only teachers and academic leaders can record competency evidence.");
}
function assertApprove(user: SessionUser) {
  if (!userCanApproveCompetencyEvidence(user)) throw new CompetencyError("FORBIDDEN", "Only result-release leaders can approve competency evidence for parent visibility.");
}

async function requireGroup(id: string) {
  const row = await tenantDb().competencyGroup.findUnique({ where: { id } });
  if (!row) throw new CompetencyError("NOT_FOUND", "Competency group not found.");
  return row;
}
async function requireCompetency(id: string) {
  const row = await tenantDb().competency.findUnique({ where: { id }, include: { group: true } });
  if (!row) throw new CompetencyError("NOT_FOUND", "Competency not found.");
  return row;
}
async function requireEvidence(id: string) {
  const row = await tenantDb().competencyEvidence.findUnique({ where: { id }, include: { competency: true } });
  if (!row) throw new CompetencyError("NOT_FOUND", "Competency evidence not found.");
  return row;
}

async function verifyOptionalLinks(input: { curriculumId?: string; learningAreaId?: string; groupId?: string; competencyId?: string; assessmentRecordId?: string; cbcAssessmentId?: string; studentId?: string }) {
  const scoped = tenantDb();
  const checks: Promise<unknown>[] = [];
  if (input.curriculumId) checks.push(scoped.curriculum.findUnique({ where: { id: input.curriculumId } }).then((x) => x || Promise.reject(new CompetencyError("NOT_FOUND", "Curriculum not found."))));
  if (input.learningAreaId) checks.push(scoped.learningArea.findUnique({ where: { id: input.learningAreaId } }).then((x) => x || Promise.reject(new CompetencyError("NOT_FOUND", "Learning area not found."))));
  if (input.groupId) checks.push(scoped.competencyGroup.findUnique({ where: { id: input.groupId } }).then((x) => x || Promise.reject(new CompetencyError("NOT_FOUND", "Competency group not found."))));
  if (input.competencyId) checks.push(scoped.competency.findUnique({ where: { id: input.competencyId } }).then((x) => x || Promise.reject(new CompetencyError("NOT_FOUND", "Competency not found."))));
  if (input.assessmentRecordId) checks.push(scoped.assessmentRecord.findUnique({ where: { id: input.assessmentRecordId } }).then((x) => x || Promise.reject(new CompetencyError("NOT_FOUND", "Assessment record not found."))));
  if (input.cbcAssessmentId) checks.push(scoped.cbcAssessment.findUnique({ where: { id: input.cbcAssessmentId } }).then((x) => x || Promise.reject(new CompetencyError("NOT_FOUND", "CBC assessment not found."))));
  if (input.studentId) checks.push(scoped.student.findUnique({ where: { id: input.studentId } }).then((x) => x || Promise.reject(new CompetencyError("NOT_FOUND", "Student not found."))));
  await Promise.all(checks);
}

async function assertTeacherMayRecordForStudent(user: SessionUser, studentId: string) {
  const allowed = await teacherClassIds(user);
  if (allowed === null) return;
  const student = await tenantDb().student.findFirst({ where: { id: studentId, status: "ACTIVE", deletedAt: null }, select: { classId: true } });
  if (!student) throw new CompetencyError("NOT_FOUND", "Student not found.");
  if (!student.classId || !allowed.includes(student.classId)) throw new CompetencyError("FORBIDDEN", "That learner is outside your classes.");
}

function averageLevel(items: { level: number | null; scorePct: number | null }[]) {
  const levels = items.map((x) => x.level).filter((x): x is number => typeof x === "number");
  if (levels.length) return Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10;
  const scores = items.map((x) => x.scorePct).filter((x): x is number => typeof x === "number");
  if (!scores.length) return null;
  const pct = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (pct >= 80) return 4;
  if (pct >= 65) return 3;
  if (pct >= 50) return 2;
  return 1;
}

export async function ensureDefaultCompetencyFramework(user: SessionUser) {
  assertManage(user);
  return withTenant(user.tenantId, async () => {
    const currentCurriculum = await tenantDb().curriculum.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    const existingGroup = await tenantDb().competencyGroup.findFirst({ where: { code: DEFAULT_GROUP.code } });
    const group = await db.competencyGroup.upsert({
      where: { tenantId_code: { tenantId: user.tenantId, code: DEFAULT_GROUP.code } },
      create: { tenantId: user.tenantId, curriculumId: currentCurriculum?.id ?? null, ...DEFAULT_GROUP },
      update: { name: DEFAULT_GROUP.name, description: DEFAULT_GROUP.description, sequence: DEFAULT_GROUP.sequence, active: true, curriculumId: currentCurriculum?.id ?? null },
    });
    let created = 0;
    let updated = 0;
    for (const item of DEFAULT_COMPETENCIES) {
      const existing = await tenantDb().competency.findFirst({ where: { code: item.code } });
      await db.competency.upsert({
        where: { tenantId_code: { tenantId: user.tenantId, code: item.code } },
        create: { tenantId: user.tenantId, groupId: group.id, curriculumId: currentCurriculum?.id ?? null, ...item, active: true },
        update: { groupId: group.id, curriculumId: currentCurriculum?.id ?? null, name: item.name, description: item.description, sequence: item.sequence, active: true },
      });
      existing ? updated++ : created++;
    }
    await audit(user, "competency.defaults_seeded", "competencyGroup", group.id, { groupCreated: !existingGroup, competenciesCreated: created, competenciesUpdated: updated });
    return { groupId: group.id, groupCreated: !existingGroup, competenciesCreated: created, competenciesUpdated: updated };
  });
}

export async function competencyBoard(user: SessionUser) {
  assertRead(user);
  return withTenant(user.tenantId, async () => {
    const [groups, competencies, evidence] = await Promise.all([
      tenantDb().competencyGroup.findMany({ orderBy: [{ sequence: "asc" }, { name: "asc" }], include: { competencies: { orderBy: [{ sequence: "asc" }, { name: "asc" }] } } }),
      tenantDb().competency.findMany({ where: { active: true }, orderBy: [{ sequence: "asc" }, { name: "asc" }] }),
      tenantDb().competencyEvidence.findMany({ where: ["PARENT", "STUDENT"].includes(user.role) ? { approved: true, visibleToParents: true } : {}, take: 500 }),
    ]);
    return {
      canManage: userCanManageCompetencies(user),
      canRecordEvidence: userCanRecordCompetencyEvidence(user),
      canApproveEvidence: userCanApproveCompetencyEvidence(user),
      groups,
      competencies,
      summary: {
        groups: groups.length,
        competencies: competencies.length,
        evidence: evidence.length,
        visibleEvidence: evidence.filter((e) => e.visibleToParents).length,
        approvedEvidence: evidence.filter((e) => e.approved).length,
      },
    };
  });
}

export async function createCompetencyGroup(user: SessionUser, input: CompetencyGroupInput) {
  assertManage(user);
  const parsed = competencyGroupSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    await verifyOptionalLinks({ curriculumId: parsed.curriculumId });
    const dup = await tenantDb().competencyGroup.findFirst({ where: { code: parsed.code } });
    if (dup) throw new CompetencyError("DUPLICATE", `Competency group ${parsed.code} already exists.`);
    const row = await tenantDb().competencyGroup.create({ data: { ...parsed, tenantId: user.tenantId, curriculumId: parsed.curriculumId ?? null, description: parsed.description ?? null } as never });
    await audit(user, "competency.group_created", "competencyGroup", row.id, { code: row.code, name: row.name });
    return row;
  });
}

export async function updateCompetencyGroup(user: SessionUser, input: CompetencyGroupUpdateInput) {
  assertManage(user);
  const parsed = competencyGroupUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await requireGroup(parsed.id);
    await verifyOptionalLinks({ curriculumId: parsed.curriculumId });
    if (parsed.code && parsed.code !== existing.code) {
      const dup = await tenantDb().competencyGroup.findFirst({ where: { code: parsed.code } });
      if (dup) throw new CompetencyError("DUPLICATE", `Competency group ${parsed.code} already exists.`);
    }
    const row = await tenantDb().competencyGroup.update({
      where: { id: existing.id },
      data: {
        ...(parsed.curriculumId !== undefined ? { curriculumId: parsed.curriculumId ?? null } : {}),
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.code !== undefined ? { code: parsed.code } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
        ...(parsed.sequence !== undefined ? { sequence: parsed.sequence } : {}),
        ...(parsed.active !== undefined ? { active: parsed.active } : {}),
      },
    });
    await audit(user, "competency.group_updated", "competencyGroup", row.id, { code: row.code, name: row.name });
    return row;
  });
}

export async function createCompetency(user: SessionUser, input: CompetencyInput) {
  assertManage(user);
  const parsed = competencySchema.parse(input);
  return withTenant(user.tenantId, async () => {
    await verifyOptionalLinks({ groupId: parsed.groupId, curriculumId: parsed.curriculumId, learningAreaId: parsed.learningAreaId });
    const dup = await tenantDb().competency.findFirst({ where: { code: parsed.code } });
    if (dup) throw new CompetencyError("DUPLICATE", `Competency ${parsed.code} already exists.`);
    const row = await tenantDb().competency.create({ data: { ...parsed, tenantId: user.tenantId, groupId: parsed.groupId ?? null, curriculumId: parsed.curriculumId ?? null, learningAreaId: parsed.learningAreaId ?? null, description: parsed.description ?? null } as never });
    await audit(user, "competency.created", "competency", row.id, { code: row.code, name: row.name });
    return row;
  });
}

export async function updateCompetency(user: SessionUser, input: CompetencyUpdateInput) {
  assertManage(user);
  const parsed = competencyUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await requireCompetency(parsed.id);
    await verifyOptionalLinks({ groupId: parsed.groupId, curriculumId: parsed.curriculumId, learningAreaId: parsed.learningAreaId });
    if (parsed.code && parsed.code !== existing.code) {
      const dup = await tenantDb().competency.findFirst({ where: { code: parsed.code } });
      if (dup) throw new CompetencyError("DUPLICATE", `Competency ${parsed.code} already exists.`);
    }
    const row = await tenantDb().competency.update({
      where: { id: existing.id },
      data: {
        ...(parsed.groupId !== undefined ? { groupId: parsed.groupId ?? null } : {}),
        ...(parsed.curriculumId !== undefined ? { curriculumId: parsed.curriculumId ?? null } : {}),
        ...(parsed.learningAreaId !== undefined ? { learningAreaId: parsed.learningAreaId ?? null } : {}),
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.code !== undefined ? { code: parsed.code } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
        ...(parsed.sequence !== undefined ? { sequence: parsed.sequence } : {}),
        ...(parsed.active !== undefined ? { active: parsed.active } : {}),
      },
    });
    await audit(user, "competency.updated", "competency", row.id, { code: row.code, name: row.name });
    return row;
  });
}

export async function recordCompetencyEvidence(user: SessionUser, input: CompetencyEvidenceInput) {
  assertRecord(user);
  const parsed = competencyEvidenceSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    await requireCompetency(parsed.competencyId);
    await verifyOptionalLinks({ studentId: parsed.studentId, assessmentRecordId: parsed.assessmentRecordId, cbcAssessmentId: parsed.cbcAssessmentId });
    await assertTeacherMayRecordForStudent(user, parsed.studentId);
    const row = await tenantDb().competencyEvidence.create({
      data: {
        ...parsed,
        tenantId: user.tenantId,
        sourceId: parsed.sourceId ?? null,
        assessmentRecordId: parsed.assessmentRecordId ?? null,
        cbcAssessmentId: parsed.cbcAssessmentId ?? null,
        level: parsed.level ?? null,
        scorePct: parsed.scorePct ?? null,
        narrative: parsed.narrative ?? null,
        recordedById: user.id,
        recordedByName: user.fullName,
      } as never,
    });
    await audit(user, "competency.evidence_recorded", "competencyEvidence", row.id, { competencyId: row.competencyId, studentId: row.studentId, sourceModule: row.sourceModule });
    return row;
  });
}

export async function updateCompetencyEvidence(user: SessionUser, input: CompetencyEvidenceUpdateInput) {
  assertRecord(user);
  const parsed = competencyEvidenceUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await requireEvidence(parsed.id);
    await assertTeacherMayRecordForStudent(user, existing.studentId);
    await verifyOptionalLinks({ competencyId: parsed.competencyId, studentId: parsed.studentId, assessmentRecordId: parsed.assessmentRecordId, cbcAssessmentId: parsed.cbcAssessmentId });
    const row = await tenantDb().competencyEvidence.update({
      where: { id: existing.id },
      data: {
        ...(parsed.competencyId !== undefined ? { competencyId: parsed.competencyId } : {}),
        ...(parsed.studentId !== undefined ? { studentId: parsed.studentId } : {}),
        ...(parsed.sourceModule !== undefined ? { sourceModule: parsed.sourceModule } : {}),
        ...(parsed.sourceId !== undefined ? { sourceId: parsed.sourceId ?? null } : {}),
        ...(parsed.assessmentRecordId !== undefined ? { assessmentRecordId: parsed.assessmentRecordId ?? null } : {}),
        ...(parsed.cbcAssessmentId !== undefined ? { cbcAssessmentId: parsed.cbcAssessmentId ?? null } : {}),
        ...(parsed.level !== undefined ? { level: parsed.level ?? null } : {}),
        ...(parsed.scorePct !== undefined ? { scorePct: parsed.scorePct ?? null } : {}),
        ...(parsed.narrative !== undefined ? { narrative: parsed.narrative ?? null } : {}),
        ...(parsed.evidenceDate !== undefined ? { evidenceDate: parsed.evidenceDate } : {}),
        ...(parsed.approved !== undefined ? { approved: parsed.approved } : {}),
        ...(parsed.visibleToParents !== undefined ? { visibleToParents: parsed.visibleToParents } : {}),
        recordedById: user.id,
        recordedByName: user.fullName,
      },
    });
    await audit(user, "competency.evidence_updated", "competencyEvidence", row.id, { competencyId: row.competencyId, studentId: row.studentId });
    return row;
  });
}

export async function approveCompetencyEvidence(user: SessionUser, input: CompetencyEvidenceApprovalInput) {
  assertApprove(user);
  const parsed = competencyEvidenceApprovalSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await requireEvidence(parsed.evidenceId);
    const row = await tenantDb().competencyEvidence.update({ where: { id: existing.id }, data: { approved: parsed.approved, visibleToParents: parsed.visibleToParents } });
    await audit(user, "competency.evidence_approved", "competencyEvidence", row.id, { approved: row.approved, visibleToParents: row.visibleToParents, note: parsed.note ?? null });
    return row;
  });
}

export async function studentCompetencySummary(user: SessionUser, studentId: string) {
  assertRead(user);
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] }, include: { schoolClass: true } });
    if (!student) throw new CompetencyError("NOT_FOUND", "Student not found.");
    const visibleWhere = ["PARENT", "STUDENT"].includes(user.role) ? { approved: true, visibleToParents: true } : {};
    const evidence = await tenantDb().competencyEvidence.findMany({
      where: { studentId, ...visibleWhere },
      include: { competency: { include: { group: true } } },
      orderBy: { evidenceDate: "desc" },
    });
    const byCompetency = new Map<string, typeof evidence>();
    for (const row of evidence) byCompetency.set(row.competencyId, [...(byCompetency.get(row.competencyId) ?? []), row]);
    return {
      student: {
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        admissionNo: student.admissionNo,
        className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
      },
      competencies: [...byCompetency.entries()].map(([competencyId, rows]) => ({
        competencyId,
        name: rows[0].competency.name,
        code: rows[0].competency.code,
        groupName: rows[0].competency.group?.name ?? null,
        evidenceCount: rows.length,
        averageLevel: averageLevel(rows),
        latest: rows[0],
      })).sort((a, b) => (b.averageLevel ?? 0) - (a.averageLevel ?? 0)),
      totalEvidence: evidence.length,
    };
  });
}

export async function competencyHeatmap(user: SessionUser, filters: { classId?: string; gradeBandId?: string } = {}) {
  assertRead(user);
  return withTenant(user.tenantId, async () => {
    const allowed = await teacherClassIds(user);
    const classFilter = filters.classId ? [filters.classId] : allowed === null ? undefined : allowed;
    const students = await tenantDb().student.findMany({
      where: { status: "ACTIVE", deletedAt: null, ...(classFilter ? { classId: { in: classFilter } } : {}) },
      select: { id: true, classId: true, schoolClass: true },
    });
    const studentIds = students.map((s) => s.id);
    const evidence = await tenantDb().competencyEvidence.findMany({ where: { studentId: { in: studentIds.length ? studentIds : ["__none__"] } }, include: { competency: true } });
    const byCompetency = new Map<string, typeof evidence>();
    for (const row of evidence) byCompetency.set(row.competencyId, [...(byCompetency.get(row.competencyId) ?? []), row]);
    return [...byCompetency.entries()].map(([competencyId, rows]) => ({
      competencyId,
      competency: rows[0].competency.name,
      code: rows[0].competency.code,
      evidenceCount: rows.length,
      learnerCount: new Set(rows.map((r) => r.studentId)).size,
      averageLevel: averageLevel(rows),
    })).sort((a, b) => (b.averageLevel ?? 0) - (a.averageLevel ?? 0));
  });
}
