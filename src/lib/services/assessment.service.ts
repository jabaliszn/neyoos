/**
 * PART J.3 — Flexible Assessment Engine service.
 *
 * This service is the real Prisma-backed backend for configurable assessments.
 * It extends existing Exams/CBC/LMS without replacing them.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { scopeWhere } from "@/lib/services/student.service";
import { teacherClassIds } from "@/lib/services/teacher-portal.service";
import {
  assessmentTypeSchema,
  assessmentTypeUpdateSchema,
  assessmentPlanSchema,
  assessmentPlanUpdateSchema,
  assessmentRecordSchema,
  assessmentRecordUpdateSchema,
  assessmentEvidenceSchema,
  assessmentRecordModerationSchema,
  assessmentPlanReleaseSchema,
  userCanReadAssessments,
  userCanManageAssessmentPlans,
  userCanScoreAssessments,
  userCanAttachAssessmentEvidence,
  userCanModerateAssessments,
  userCanReleaseAssessments,
  type AssessmentTypeInput,
  type AssessmentTypeUpdateInput,
  type AssessmentPlanInput,
  type AssessmentPlanUpdateInput,
  type AssessmentRecordInput,
  type AssessmentRecordUpdateInput,
  type AssessmentEvidenceInput,
  type AssessmentRecordModerationInput,
  type AssessmentPlanReleaseInput,
} from "@/lib/validations/assessment";

export class AssessmentError extends Error {
  constructor(
    public code: "NOT_FOUND" | "DUPLICATE" | "FORBIDDEN" | "INVALID" | "STATE",
    message: string
  ) {
    super(message);
    this.name = "AssessmentError";
  }
}

const DEFAULT_ASSESSMENT_TYPES: AssessmentTypeInput[] = [
  { key: "EXAM", name: "Exam", category: "FORMAL", scoreMode: "MARKS", defaultMaxMarks: 100, defaultWeight: 40, evidenceAllowed: false, requiresModeration: true, active: true },
  { key: "CAT", name: "Continuous Assessment Test", category: "FORMAL", scoreMode: "MARKS", defaultMaxMarks: 100, defaultWeight: 20, evidenceAllowed: false, requiresModeration: true, active: true },
  { key: "PROJECT", name: "Project", category: "PRACTICAL", scoreMode: "MIXED", defaultMaxMarks: 100, defaultWeight: 20, evidenceAllowed: true, requiresModeration: true, active: true },
  { key: "PRACTICAL", name: "Practical", category: "PRACTICAL", scoreMode: "MIXED", defaultMaxMarks: 100, defaultWeight: 20, evidenceAllowed: true, requiresModeration: true, active: true },
  { key: "ORAL", name: "Oral", category: "OBSERVATION", scoreMode: "RUBRIC", defaultWeight: 10, evidenceAllowed: true, requiresModeration: false, active: true },
  { key: "OBSERVATION", name: "Teacher observation", category: "OBSERVATION", scoreMode: "NARRATIVE", defaultWeight: 0, evidenceAllowed: true, requiresModeration: false, active: true },
  { key: "PORTFOLIO", name: "Portfolio", category: "PORTFOLIO", scoreMode: "MIXED", defaultWeight: 20, evidenceAllowed: true, requiresModeration: true, active: true },
  { key: "PEER", name: "Peer assessment", category: "SCHOOL_DEFINED", scoreMode: "RUBRIC", defaultWeight: 0, evidenceAllowed: false, requiresModeration: true, active: true },
  { key: "SELF", name: "Self assessment", category: "SCHOOL_DEFINED", scoreMode: "NARRATIVE", defaultWeight: 0, evidenceAllowed: false, requiresModeration: true, active: true },
  { key: "CONTINUOUS", name: "Continuous assessment", category: "SCHOOL_DEFINED", scoreMode: "MIXED", defaultWeight: 20, evidenceAllowed: true, requiresModeration: true, active: true },
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
  if (!userCanReadAssessments(user)) throw new AssessmentError("FORBIDDEN", "You do not have permission to view assessments.");
}
function assertManagePlans(user: SessionUser) {
  if (!userCanManageAssessmentPlans(user)) throw new AssessmentError("FORBIDDEN", "Only academic leaders can manage assessment plans.");
}
function assertScore(user: SessionUser) {
  if (!userCanScoreAssessments(user)) throw new AssessmentError("FORBIDDEN", "Only teachers and academic leaders can score assessments.");
}
function assertAttachEvidence(user: SessionUser) {
  if (!userCanAttachAssessmentEvidence(user)) throw new AssessmentError("FORBIDDEN", "Only teachers and academic leaders can attach assessment evidence.");
}
function assertModerate(user: SessionUser) {
  if (!userCanModerateAssessments(user)) throw new AssessmentError("FORBIDDEN", "Only academic leaders can moderate assessments.");
}
function assertRelease(user: SessionUser) {
  if (!userCanReleaseAssessments(user)) throw new AssessmentError("FORBIDDEN", "Only the Principal, Dean, Deputy or Owner can release flexible assessments.");
}

function fullName(s: { firstName: string; middleName: string | null; lastName: string }) {
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
}

async function ensureType(id: string) {
  const type = await tenantDb().assessmentType.findUnique({ where: { id } });
  if (!type) throw new AssessmentError("NOT_FOUND", "Assessment type not found.");
  return type;
}

async function ensurePlan(id: string) {
  const plan = await tenantDb().assessmentPlan.findUnique({ where: { id }, include: { assessmentType: true } });
  if (!plan) throw new AssessmentError("NOT_FOUND", "Assessment plan not found.");
  return plan;
}

async function ensureRecord(id: string) {
  const record = await tenantDb().assessmentRecord.findUnique({ where: { id }, include: { plan: { include: { assessmentType: true } } } });
  if (!record) throw new AssessmentError("NOT_FOUND", "Assessment record not found.");
  return record;
}

async function verifyOptionalLinks(input: Partial<AssessmentPlanInput | AssessmentPlanUpdateInput>) {
  const scoped = tenantDb();
  const checks: Promise<unknown>[] = [];
  if (input.assessmentTypeId) checks.push(ensureType(input.assessmentTypeId));
  if (input.curriculumId) checks.push(scoped.curriculum.findUnique({ where: { id: input.curriculumId } }).then((x) => x || Promise.reject(new AssessmentError("NOT_FOUND", "Curriculum not found."))));
  if (input.educationLevelId) checks.push(scoped.educationLevel.findUnique({ where: { id: input.educationLevelId } }).then((x) => x || Promise.reject(new AssessmentError("NOT_FOUND", "Education level not found."))));
  if (input.gradeBandId) checks.push(scoped.gradeBand.findUnique({ where: { id: input.gradeBandId } }).then((x) => x || Promise.reject(new AssessmentError("NOT_FOUND", "Grade band not found."))));
  if (input.learningAreaId) checks.push(scoped.learningArea.findUnique({ where: { id: input.learningAreaId } }).then((x) => x || Promise.reject(new AssessmentError("NOT_FOUND", "Learning area not found."))));
  if (input.subjectId) checks.push(scoped.subject.findUnique({ where: { id: input.subjectId } }).then((x) => x || Promise.reject(new AssessmentError("NOT_FOUND", "Subject not found."))));
  if (input.classId) checks.push(scoped.schoolClass.findUnique({ where: { id: input.classId } }).then((x) => x || Promise.reject(new AssessmentError("NOT_FOUND", "Class not found."))));
  if (input.academicTermId) checks.push(scoped.academicTerm.findUnique({ where: { id: input.academicTermId } }).then((x) => x || Promise.reject(new AssessmentError("NOT_FOUND", "Academic term not found."))));
  if (input.examId) checks.push(scoped.exam.findUnique({ where: { id: input.examId } }).then((x) => x || Promise.reject(new AssessmentError("NOT_FOUND", "Exam not found."))));
  if (input.homeworkId) checks.push(scoped.homework.findUnique({ where: { id: input.homeworkId } }).then((x) => x || Promise.reject(new AssessmentError("NOT_FOUND", "Homework not found."))));
  if (input.quizId) checks.push(scoped.quiz.findUnique({ where: { id: input.quizId } }).then((x) => x || Promise.reject(new AssessmentError("NOT_FOUND", "Quiz not found."))));
  if (input.cbcStrandId) checks.push(scoped.cbcStrand.findUnique({ where: { id: input.cbcStrandId } }).then((x) => x || Promise.reject(new AssessmentError("NOT_FOUND", "CBC strand not found."))));
  await Promise.all(checks);
}

async function assertPlanClassAccess(user: SessionUser, plan: { classId: string | null }) {
  const allowed = await teacherClassIds(user);
  if (allowed === null) return;
  if (!plan.classId || !allowed.includes(plan.classId)) {
    throw new AssessmentError("FORBIDDEN", "That assessment is not for one of your classes.");
  }
}

async function assertRecordStudentAllowed(user: SessionUser, studentId: string, classId: string | null) {
  const allowedClasses = await teacherClassIds(user);
  if (allowedClasses !== null) {
    if (!classId || !allowedClasses.includes(classId)) throw new AssessmentError("FORBIDDEN", "That learner is outside your assessment classes.");
  }
  const student = await tenantDb().student.findFirst({ where: { id: studentId, status: "ACTIVE", deletedAt: null }, include: { schoolClass: true } });
  if (!student) throw new AssessmentError("NOT_FOUND", "Student not found.");
  if (classId && student.classId !== classId) throw new AssessmentError("INVALID", "This learner is not in the assessment class.");
  return student;
}

async function visiblePlanWhereForUser(user: SessionUser) {
  const base: Record<string, unknown> = {};
  if (["PARENT", "STUDENT"].includes(user.role)) {
    const scope = await scopeWhere(user);
    const children = await tenantDb().student.findMany({ where: { AND: [scope, { status: "ACTIVE", deletedAt: null }] }, select: { id: true, classId: true } });
    const classIds = [...new Set(children.map((c) => c.classId).filter((x): x is string => Boolean(x)))];
    return {
      ...base,
      status: "RELEASED",
      visibleToParents: true,
      OR: [
        { classId: { in: classIds.length ? classIds : ["__none__"] } },
        { records: { some: { studentId: { in: children.map((c) => c.id) } } } },
      ],
    };
  }
  const allowed = await teacherClassIds(user);
  if (allowed !== null) return { ...base, classId: { in: allowed } };
  return base;
}

export async function ensureDefaultAssessmentTypes(user: SessionUser) {
  assertManagePlans(user);
  return withTenant(user.tenantId, async () => {
    let created = 0;
    let updated = 0;
    for (const raw of DEFAULT_ASSESSMENT_TYPES) {
      const parsed = assessmentTypeSchema.parse(raw);
      const existing = await tenantDb().assessmentType.findFirst({ where: { key: parsed.key } });
      await db.assessmentType.upsert({
        where: { tenantId_key: { tenantId: user.tenantId, key: parsed.key } },
        create: { tenantId: user.tenantId, ...parsed, isSystem: true },
        update: { name: parsed.name, description: parsed.description ?? null, category: parsed.category, scoreMode: parsed.scoreMode, defaultMaxMarks: parsed.defaultMaxMarks ?? null, defaultWeight: parsed.defaultWeight, evidenceAllowed: parsed.evidenceAllowed, requiresModeration: parsed.requiresModeration, active: parsed.active, isSystem: true },
      });
      existing ? updated++ : created++;
    }
    await audit(user, "assessment.types_seeded", "assessmentType", user.tenantId, { created, updated });
    return { created, updated, total: DEFAULT_ASSESSMENT_TYPES.length };
  });
}

export async function assessmentBoard(user: SessionUser) {
  assertRead(user);
  return withTenant(user.tenantId, async () => {
    const where = await visiblePlanWhereForUser(user);
    const [types, plans] = await Promise.all([
      tenantDb().assessmentType.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
      tenantDb().assessmentPlan.findMany({
        where,
        orderBy: [{ year: "desc" }, { term: "desc" }, { createdAt: "desc" }],
        include: { assessmentType: true, records: { include: { evidence: true } } },
        take: 200,
      }),
    ]);
    return {
      canManagePlans: userCanManageAssessmentPlans(user),
      canScore: userCanScoreAssessments(user),
      canModerate: userCanModerateAssessments(user),
      canRelease: userCanReleaseAssessments(user),
      types,
      plans,
      summary: {
        types: types.length,
        plans: plans.length,
        records: plans.reduce((sum, p) => sum + p.records.length, 0),
        evidence: plans.reduce((sum, p) => sum + p.records.reduce((s, r) => s + r.evidence.length, 0), 0),
        releasedPlans: plans.filter((p) => p.status === "RELEASED").length,
      },
    };
  });
}

export async function createAssessmentType(user: SessionUser, input: AssessmentTypeInput) {
  assertManagePlans(user);
  const parsed = assessmentTypeSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const dup = await tenantDb().assessmentType.findFirst({ where: { key: parsed.key } });
    if (dup) throw new AssessmentError("DUPLICATE", `Assessment type ${parsed.key} already exists.`);
    const row = await tenantDb().assessmentType.create({ data: { ...parsed, tenantId: user.tenantId, isSystem: false } as never });
    await audit(user, "assessment.type_created", "assessmentType", row.id, { key: row.key, name: row.name });
    return row;
  });
}

export async function updateAssessmentType(user: SessionUser, input: AssessmentTypeUpdateInput) {
  assertManagePlans(user);
  const parsed = assessmentTypeUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await ensureType(parsed.id);
    if (parsed.key && parsed.key !== existing.key) {
      const dup = await tenantDb().assessmentType.findFirst({ where: { key: parsed.key } });
      if (dup) throw new AssessmentError("DUPLICATE", `Assessment type ${parsed.key} already exists.`);
    }
    const row = await tenantDb().assessmentType.update({
      where: { id: existing.id },
      data: {
        ...(parsed.key !== undefined ? { key: parsed.key } : {}),
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
        ...(parsed.category !== undefined ? { category: parsed.category } : {}),
        ...(parsed.scoreMode !== undefined ? { scoreMode: parsed.scoreMode } : {}),
        ...(parsed.defaultMaxMarks !== undefined ? { defaultMaxMarks: parsed.defaultMaxMarks ?? null } : {}),
        ...(parsed.defaultWeight !== undefined ? { defaultWeight: parsed.defaultWeight } : {}),
        ...(parsed.effectiveFrom !== undefined ? { effectiveFrom: parsed.effectiveFrom ?? null } : {}),
        ...(parsed.effectiveTo !== undefined ? { effectiveTo: parsed.effectiveTo ?? null } : {}),
        ...(parsed.evidenceAllowed !== undefined ? { evidenceAllowed: parsed.evidenceAllowed } : {}),
        ...(parsed.requiresModeration !== undefined ? { requiresModeration: parsed.requiresModeration } : {}),
        ...(parsed.active !== undefined ? { active: parsed.active } : {}),
      },
    });
    await audit(user, "assessment.type_updated", "assessmentType", row.id, { key: row.key, name: row.name });
    return row;
  });
}

export async function createAssessmentPlan(user: SessionUser, input: AssessmentPlanInput) {
  assertManagePlans(user);
  const parsed = assessmentPlanSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    await verifyOptionalLinks(parsed);
    const type = await ensureType(parsed.assessmentTypeId);
    const row = await tenantDb().assessmentPlan.create({
      data: {
        ...parsed,
        tenantId: user.tenantId,
        maxMarks: parsed.maxMarks ?? type.defaultMaxMarks ?? null,
        createdById: user.id,
        createdByName: user.fullName,
      } as never,
    });
    await audit(user, "assessment.plan_created", "assessmentPlan", row.id, { title: row.title, assessmentTypeId: row.assessmentTypeId, classId: row.classId });
    return row;
  });
}

export async function updateAssessmentPlan(user: SessionUser, input: AssessmentPlanUpdateInput) {
  assertManagePlans(user);
  const parsed = assessmentPlanUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await ensurePlan(parsed.id);
    await verifyOptionalLinks(parsed);
    const row = await tenantDb().assessmentPlan.update({
      where: { id: existing.id },
      data: {
        ...(parsed.assessmentTypeId !== undefined ? { assessmentTypeId: parsed.assessmentTypeId } : {}),
        ...(parsed.curriculumId !== undefined ? { curriculumId: parsed.curriculumId ?? null } : {}),
        ...(parsed.educationLevelId !== undefined ? { educationLevelId: parsed.educationLevelId ?? null } : {}),
        ...(parsed.gradeBandId !== undefined ? { gradeBandId: parsed.gradeBandId ?? null } : {}),
        ...(parsed.learningAreaId !== undefined ? { learningAreaId: parsed.learningAreaId ?? null } : {}),
        ...(parsed.subjectId !== undefined ? { subjectId: parsed.subjectId ?? null } : {}),
        ...(parsed.classId !== undefined ? { classId: parsed.classId ?? null } : {}),
        ...(parsed.academicTermId !== undefined ? { academicTermId: parsed.academicTermId ?? null } : {}),
        ...(parsed.examId !== undefined ? { examId: parsed.examId ?? null } : {}),
        ...(parsed.homeworkId !== undefined ? { homeworkId: parsed.homeworkId ?? null } : {}),
        ...(parsed.quizId !== undefined ? { quizId: parsed.quizId ?? null } : {}),
        ...(parsed.cbcStrandId !== undefined ? { cbcStrandId: parsed.cbcStrandId ?? null } : {}),
        ...(parsed.year !== undefined ? { year: parsed.year } : {}),
        ...(parsed.term !== undefined ? { term: parsed.term } : {}),
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
        ...(parsed.instructions !== undefined ? { instructions: parsed.instructions ?? null } : {}),
        ...(parsed.weight !== undefined ? { weight: parsed.weight } : {}),
        ...(parsed.maxMarks !== undefined ? { maxMarks: parsed.maxMarks ?? null } : {}),
        ...(parsed.dueDate !== undefined ? { dueDate: parsed.dueDate ?? null } : {}),
        ...(parsed.rubricJson !== undefined ? { rubricJson: parsed.rubricJson ?? null } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.visibleToParents !== undefined ? { visibleToParents: parsed.visibleToParents } : {}),
      },
    });
    await audit(user, "assessment.plan_updated", "assessmentPlan", row.id, { title: row.title, status: row.status });
    return row;
  });
}

export async function assessmentSheet(user: SessionUser, planId: string) {
  assertRead(user);
  return withTenant(user.tenantId, async () => {
    const plan = await ensurePlan(planId);
    await assertPlanClassAccess(user, plan);
    const scope = await scopeWhere(user);
    const students = await tenantDb().student.findMany({
      where: { AND: [scope, { ...(plan.classId ? { classId: plan.classId } : {}), status: "ACTIVE", deletedAt: null }] },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true, classId: true },
    });
    const records = await tenantDb().assessmentRecord.findMany({ where: { planId, studentId: { in: students.map((s) => s.id) } }, include: { evidence: true } });
    const byStudent = new Map(records.map((r) => [r.studentId, r]));
    return {
      plan,
      students: students.map((s) => ({ id: s.id, name: fullName(s), admissionNo: s.admissionNo, classId: s.classId, record: byStudent.get(s.id) ?? null })),
    };
  });
}

export async function scoreAssessmentRecord(user: SessionUser, input: AssessmentRecordInput) {
  assertScore(user);
  const parsed = assessmentRecordSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const plan = await ensurePlan(parsed.planId);
    if (!["DRAFT", "ACTIVE", "MODERATION"].includes(plan.status)) throw new AssessmentError("STATE", "This assessment plan is already released or archived.");
    await assertPlanClassAccess(user, plan);
    const student = await assertRecordStudentAllowed(user, parsed.studentId, plan.classId);
    if (parsed.scoreMarks !== undefined && plan.maxMarks && parsed.scoreMarks > plan.maxMarks) throw new AssessmentError("INVALID", `Marks cannot exceed ${plan.maxMarks}.`);
    const scorePct = parsed.scorePct ?? (parsed.scoreMarks !== undefined && plan.maxMarks ? Math.round((parsed.scoreMarks / Math.max(1, plan.maxMarks)) * 100) : undefined);
    const row = await db.assessmentRecord.upsert({
      where: { tenantId_planId_studentId: { tenantId: user.tenantId, planId: parsed.planId, studentId: parsed.studentId } },
      create: {
        tenantId: user.tenantId,
        planId: parsed.planId,
        studentId: parsed.studentId,
        scoreMarks: parsed.scoreMarks ?? null,
        scorePct: scorePct ?? null,
        rubricLevel: parsed.rubricLevel ?? null,
        rubricCode: parsed.rubricCode ?? null,
        narrative: parsed.narrative ?? null,
        status: parsed.status,
        sourceModule: parsed.sourceModule ?? "MANUAL",
        sourceId: parsed.sourceId ?? null,
        assessedById: user.id,
        assessedByName: user.fullName,
      },
      update: {
        scoreMarks: parsed.scoreMarks ?? null,
        scorePct: scorePct ?? null,
        rubricLevel: parsed.rubricLevel ?? null,
        rubricCode: parsed.rubricCode ?? null,
        narrative: parsed.narrative ?? null,
        status: parsed.status,
        sourceModule: parsed.sourceModule ?? "MANUAL",
        sourceId: parsed.sourceId ?? null,
        assessedById: user.id,
        assessedByName: user.fullName,
        assessedAt: new Date(),
      },
    });
    await audit(user, "assessment.record_scored", "assessmentRecord", row.id, { planId: plan.id, student: fullName(student), scorePct });
    return row;
  });
}

export async function updateAssessmentRecord(user: SessionUser, input: AssessmentRecordUpdateInput) {
  assertScore(user);
  const parsed = assessmentRecordUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await ensureRecord(parsed.id);
    if (!["DRAFT", "ACTIVE", "MODERATION"].includes(existing.plan.status)) throw new AssessmentError("STATE", "This assessment plan is already released or archived.");
    await assertPlanClassAccess(user, existing.plan);
    const scorePct = parsed.scorePct ?? (parsed.scoreMarks !== undefined && existing.plan.maxMarks ? Math.round((parsed.scoreMarks / Math.max(1, existing.plan.maxMarks)) * 100) : undefined);
    const row = await tenantDb().assessmentRecord.update({
      where: { id: existing.id },
      data: {
        ...(parsed.scoreMarks !== undefined ? { scoreMarks: parsed.scoreMarks } : {}),
        ...(scorePct !== undefined ? { scorePct } : {}),
        ...(parsed.rubricLevel !== undefined ? { rubricLevel: parsed.rubricLevel } : {}),
        ...(parsed.rubricCode !== undefined ? { rubricCode: parsed.rubricCode ?? null } : {}),
        ...(parsed.narrative !== undefined ? { narrative: parsed.narrative ?? null } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        assessedById: user.id,
        assessedByName: user.fullName,
        assessedAt: new Date(),
      },
    });
    await audit(user, "assessment.record_updated", "assessmentRecord", row.id, { planId: row.planId });
    return row;
  });
}

export async function attachAssessmentEvidence(user: SessionUser, input: AssessmentEvidenceInput) {
  assertAttachEvidence(user);
  const parsed = assessmentEvidenceSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const record = await ensureRecord(parsed.recordId);
    await assertPlanClassAccess(user, record.plan);
    if (!record.plan.assessmentType.evidenceAllowed) throw new AssessmentError("INVALID", "This assessment type does not allow evidence attachments.");
    if (parsed.storedFileId) {
      const file = await tenantDb().storedFile.findUnique({ where: { id: parsed.storedFileId } });
      if (!file) throw new AssessmentError("NOT_FOUND", "Stored evidence file not found.");
      if (!file.encrypted) throw new AssessmentError("INVALID", "Assessment evidence must use encrypted Storage Vault files.");
    }
    const row = await tenantDb().assessmentEvidence.create({
      data: {
        recordId: parsed.recordId,
        storedFileId: parsed.storedFileId ?? null,
        fileUrl: parsed.fileUrl ?? null,
        fileName: parsed.fileName ?? null,
        contentType: parsed.contentType ?? null,
        evidenceType: parsed.evidenceType,
        note: parsed.note ?? null,
        uploadedById: user.id,
        uploadedByName: user.fullName,
      } as never,
    });
    await audit(user, "assessment.evidence_attached", "assessmentEvidence", row.id, { recordId: record.id, evidenceType: row.evidenceType });
    return row;
  });
}

export async function moderateAssessmentRecord(user: SessionUser, input: AssessmentRecordModerationInput) {
  assertModerate(user);
  const parsed = assessmentRecordModerationSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const record = await ensureRecord(parsed.recordId);
    const row = await tenantDb().assessmentRecord.update({
      where: { id: record.id },
      data: {
        status: parsed.status,
        moderatedById: user.id,
        moderatedByName: user.fullName,
        moderatedAt: new Date(),
        ...(parsed.status === "RELEASED" ? { releasedAt: new Date() } : {}),
      },
    });
    await audit(user, parsed.status === "RELEASED" ? "assessment.record_released" : "assessment.record_moderated", "assessmentRecord", row.id, { note: parsed.note ?? null });
    return row;
  });
}

export async function releaseAssessmentPlan(user: SessionUser, input: AssessmentPlanReleaseInput) {
  assertRelease(user);
  const parsed = assessmentPlanReleaseSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const plan = await ensurePlan(parsed.planId);
    const recordCount = await tenantDb().assessmentRecord.count({ where: { planId: plan.id } });
    if (recordCount === 0) throw new AssessmentError("STATE", "Score at least one learner before releasing this assessment.");
    const now = new Date();
    const row = await tenantDb().assessmentPlan.update({ where: { id: plan.id }, data: { status: "RELEASED", visibleToParents: parsed.visibleToParents, updatedAt: now } });
    await tenantDb().assessmentRecord.updateMany({ where: { planId: plan.id, status: { in: ["SCORED", "SUBMITTED", "MODERATED"] } }, data: { status: "RELEASED", releasedAt: now } });
    await audit(user, "assessment.plan_released", "assessmentPlan", row.id, { records: recordCount, visibleToParents: parsed.visibleToParents, note: parsed.note ?? null });
    return row;
  });
}
