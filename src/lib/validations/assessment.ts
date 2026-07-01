/**
 * PART J.3 — Flexible Assessment Engine validation + access rules.
 *
 * This file protects the compatible assessment layer added in J.3 Chunk 1.
 * It deliberately extends existing Exams/CBC/LMS instead of replacing them.
 */
import { z } from "zod";
import { can, type Permission } from "@/lib/core/permissions";
import { ROLES, type Role } from "@/lib/core/roles";
import type { SessionUser } from "@/lib/core/session";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalDateYmd = z
  .union([dateYmd, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalId = z
  .union([z.string().min(1), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalText = (max = 1000) =>
  z
    .union([z.string().trim().max(max), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : undefined));

const safeTitle = z
  .string()
  .trim()
  .min(2, "Title is too short")
  .max(140, "Title is too long")
  .regex(/^[\p{L}\p{N}\s'’().,&/+:-]+$/u, "Use letters, numbers and simple punctuation only");

const keyCode = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dash or underscore only")
  .transform((value) => value.toUpperCase());

export const ASSESSMENT_TYPE_KEYS = [
  "EXAM",
  "CAT",
  "PROJECT",
  "PRACTICAL",
  "ORAL",
  "OBSERVATION",
  "PORTFOLIO",
  "PEER",
  "SELF",
  "CONTINUOUS",
  "CUSTOM",
] as const;

export const ASSESSMENT_CATEGORIES = ["FORMAL", "PRACTICAL", "PORTFOLIO", "OBSERVATION", "SCHOOL_DEFINED"] as const;
export const ASSESSMENT_SCORE_MODES = ["MARKS", "RUBRIC", "NARRATIVE", "MIXED"] as const;
export const ASSESSMENT_PLAN_STATUSES = ["DRAFT", "ACTIVE", "MODERATION", "RELEASED", "ARCHIVED"] as const;
export const ASSESSMENT_RECORD_STATUSES = ["DRAFT", "SCORED", "SUBMITTED", "MODERATED", "RELEASED"] as const;
export const ASSESSMENT_SOURCE_MODULES = ["EXAM", "CBC", "LMS_HOMEWORK", "LMS_QUIZ", "MANUAL", "PORTFOLIO"] as const;
export const ASSESSMENT_EVIDENCE_TYPES = ["FILE", "LINK", "NOTE", "PHOTO", "VIDEO", "CERTIFICATE"] as const;

export const ASSESSMENT_READ_PERMISSIONS = ["academics.view", "exam.view"] as const satisfies readonly Permission[];
export const ASSESSMENT_PLAN_MANAGE_PERMISSIONS = ["academics.manage", "exam.manage"] as const satisfies readonly Permission[];
export const ASSESSMENT_SCORE_PERMISSIONS = ["exam.enter_marks", "homework.assign", "academics.manage"] as const satisfies readonly Permission[];
export const ASSESSMENT_MODERATE_PERMISSIONS = ["academics.manage", "exam.manage"] as const satisfies readonly Permission[];
export const ASSESSMENT_RELEASE_PERMISSIONS = ["exam.publish"] as const satisfies readonly Permission[];
export const ASSESSMENT_EVIDENCE_PERMISSIONS = ["exam.enter_marks", "homework.assign", "academics.manage"] as const satisfies readonly Permission[];

const assessmentTypeFields = z
  .object({
    key: keyCode,
    name: safeTitle,
    description: optionalText(500),
    category: z.enum(ASSESSMENT_CATEGORIES).default("SCHOOL_DEFINED"),
    scoreMode: z.enum(ASSESSMENT_SCORE_MODES).default("MIXED"),
    defaultMaxMarks: z.coerce.number().int().min(1).max(1000).optional(),
    defaultWeight: z.coerce.number().int().min(0).max(100).default(0),
    // J.20 — assessment templates carry effective dates so a school can version
    // its assessment definitions across curriculum updates (e.g. CBC 2026 vs 2027).
    effectiveFrom: optionalDateYmd,
    effectiveTo: optionalDateYmd,
    evidenceAllowed: z.boolean().default(true),
    requiresModeration: z.boolean().default(true),
    active: z.boolean().default(true),
  })
  .strict();

const assessmentTypeEffectiveDatesValid = (value: { effectiveFrom?: string; effectiveTo?: string }) =>
  !value.effectiveFrom || !value.effectiveTo || value.effectiveTo >= value.effectiveFrom;

export const assessmentTypeSchema = assessmentTypeFields.refine(assessmentTypeEffectiveDatesValid, {
  message: "Effective end date cannot be before the start date.",
  path: ["effectiveTo"],
});
export const assessmentTypeUpdateSchema = assessmentTypeFields
  .partial()
  .extend({ id: z.string().min(1) })
  .strict()
  .refine(assessmentTypeEffectiveDatesValid, {
    message: "Effective end date cannot be before the start date.",
    path: ["effectiveTo"],
  });
export type AssessmentTypeInput = z.input<typeof assessmentTypeSchema>;
export type AssessmentTypeUpdateInput = z.input<typeof assessmentTypeUpdateSchema>;

const assessmentPlanFields = z
  .object({
    assessmentTypeId: z.string().min(1),
    curriculumId: optionalId,
    educationLevelId: optionalId,
    gradeBandId: optionalId,
    learningAreaId: optionalId,
    subjectId: optionalId,
    classId: optionalId,
    academicTermId: optionalId,
    examId: optionalId,
    homeworkId: optionalId,
    quizId: optionalId,
    cbcStrandId: optionalId,
    year: z.coerce.number().int().min(2000).max(2100),
    term: z.coerce.number().int().min(1).max(6),
    title: safeTitle,
    description: optionalText(700),
    instructions: optionalText(1500),
    weight: z.coerce.number().int().min(0).max(100).default(0),
    maxMarks: z.coerce.number().int().min(1).max(1000).optional(),
    dueDate: optionalDateYmd,
    rubricJson: optionalText(5000),
    status: z.enum(ASSESSMENT_PLAN_STATUSES).default("DRAFT"),
    visibleToParents: z.boolean().default(false),
  })
  .strict();

function planHasAcademicScope(value: { learningAreaId?: string; subjectId?: string; classId?: string; gradeBandId?: string; cbcStrandId?: string; examId?: string; homeworkId?: string; quizId?: string }) {
  return Boolean(value.learningAreaId || value.subjectId || value.classId || value.gradeBandId || value.cbcStrandId || value.examId || value.homeworkId || value.quizId);
}

export const assessmentPlanSchema = assessmentPlanFields.refine(planHasAcademicScope, {
  message: "Choose at least one academic scope: learning area, subject, class, grade band, CBC strand, exam, homework or quiz.",
  path: ["subjectId"],
});
function planUpdateScopeIsValid(value: { learningAreaId?: string; subjectId?: string; classId?: string; gradeBandId?: string; cbcStrandId?: string; examId?: string; homeworkId?: string; quizId?: string }) {
  const scopeKeys = ["learningAreaId", "subjectId", "classId", "gradeBandId", "cbcStrandId", "examId", "homeworkId", "quizId"] as const;
  const attemptedScopeUpdate = scopeKeys.some((key) => key in value);
  return !attemptedScopeUpdate || planHasAcademicScope(value);
}

export const assessmentPlanUpdateSchema = assessmentPlanFields
  .partial()
  .extend({ id: z.string().min(1) })
  .strict()
  .refine(planUpdateScopeIsValid, {
    message: "Choose at least one academic scope: learning area, subject, class, grade band, CBC strand, exam, homework or quiz.",
    path: ["subjectId"],
  });
export type AssessmentPlanInput = z.input<typeof assessmentPlanSchema>;
export type AssessmentPlanUpdateInput = z.input<typeof assessmentPlanUpdateSchema>;

const assessmentRecordFields = z
  .object({
    planId: z.string().min(1),
    studentId: z.string().min(1),
    scoreMarks: z.coerce.number().min(0).max(10000).optional(),
    scorePct: z.coerce.number().int().min(0).max(100).optional(),
    rubricLevel: z.coerce.number().int().min(1).max(10).optional(),
    rubricCode: optionalText(16),
    narrative: optionalText(2500),
    status: z.enum(ASSESSMENT_RECORD_STATUSES).default("SCORED"),
    sourceModule: z.enum(ASSESSMENT_SOURCE_MODULES).optional(),
    sourceId: optionalId,
  })
  .strict();

function recordHasAssessment(value: { scoreMarks?: number; scorePct?: number; rubricLevel?: number; rubricCode?: string; narrative?: string }) {
  return value.scoreMarks !== undefined || value.scorePct !== undefined || value.rubricLevel !== undefined || Boolean(value.rubricCode) || Boolean(value.narrative);
}

export const assessmentRecordSchema = assessmentRecordFields.refine(recordHasAssessment, {
  message: "Add marks, a percentage, a rubric level/code or a narrative observation.",
  path: ["scoreMarks"],
});
export const assessmentRecordUpdateSchema = assessmentRecordFields
  .partial()
  .extend({ id: z.string().min(1) })
  .strict()
  .refine(recordHasAssessment, {
    message: "Add marks, a percentage, a rubric level/code or a narrative observation.",
    path: ["scoreMarks"],
  });
export type AssessmentRecordInput = z.input<typeof assessmentRecordSchema>;
export type AssessmentRecordUpdateInput = z.input<typeof assessmentRecordUpdateSchema>;

const assessmentEvidenceFields = z
  .object({
    recordId: z.string().min(1),
    storedFileId: optionalId,
    fileUrl: optionalText(500),
    fileName: optionalText(180),
    contentType: optionalText(120),
    evidenceType: z.enum(ASSESSMENT_EVIDENCE_TYPES).default("FILE"),
    note: optionalText(1000),
  })
  .strict();

function evidenceHasReference(value: { storedFileId?: string; fileUrl?: string; note?: string }) {
  return Boolean(value.storedFileId || value.fileUrl || value.note);
}

function evidenceAvoidsLegacyRoutes(value: { fileUrl?: string }) {
  if (!value.fileUrl) return true;
  return !["/api/files/presign", "/api/files/confirm", "/api/files/dev-put"].some((route) => value.fileUrl!.includes(route));
}

export const assessmentEvidenceSchema = assessmentEvidenceFields
  .refine(evidenceHasReference, {
    message: "Attach a file reference, link or note for this evidence.",
    path: ["fileUrl"],
  })
  .refine(evidenceAvoidsLegacyRoutes, {
    message: "Assessment evidence must use the encrypted Storage Vault upload path, not legacy direct upload routes.",
    path: ["fileUrl"],
  });
export type AssessmentEvidenceInput = z.input<typeof assessmentEvidenceSchema>;

export const assessmentRecordModerationSchema = z
  .object({
    recordId: z.string().min(1),
    status: z.enum(["MODERATED", "RELEASED"]),
    note: optionalText(700),
  })
  .strict();
export type AssessmentRecordModerationInput = z.input<typeof assessmentRecordModerationSchema>;

export const assessmentPlanReleaseSchema = z
  .object({
    planId: z.string().min(1),
    visibleToParents: z.boolean().default(true),
    note: optionalText(700),
  })
  .strict();
export type AssessmentPlanReleaseInput = z.input<typeof assessmentPlanReleaseSchema>;

export const assessmentActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("seed_default_types"), payload: z.object({}).default({}) }).strict(),
  z.object({ action: z.literal("create_type"), payload: assessmentTypeSchema }).strict(),
  z.object({ action: z.literal("update_type"), payload: assessmentTypeUpdateSchema }).strict(),
  z.object({ action: z.literal("create_plan"), payload: assessmentPlanSchema }).strict(),
  z.object({ action: z.literal("update_plan"), payload: assessmentPlanUpdateSchema }).strict(),
  z.object({ action: z.literal("score_record"), payload: assessmentRecordSchema }).strict(),
  z.object({ action: z.literal("update_record"), payload: assessmentRecordUpdateSchema }).strict(),
  z.object({ action: z.literal("attach_evidence"), payload: assessmentEvidenceSchema }).strict(),
  z.object({ action: z.literal("moderate_record"), payload: assessmentRecordModerationSchema }).strict(),
  z.object({ action: z.literal("release_plan"), payload: assessmentPlanReleaseSchema }).strict(),
]);
export type AssessmentActionInput = z.input<typeof assessmentActionSchema>;

function roleHasAny(role: Role, permissions: readonly Permission[]) {
  return permissions.some((permission) => can(role, permission));
}

function userHasAnyPermission(user: Pick<SessionUser, "role" | "secondaryRole">, permissions: readonly Permission[]) {
  return roleHasAny(user.role, permissions) || (!!user.secondaryRole && roleHasAny(user.secondaryRole, permissions));
}

export function userCanReadAssessments(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, ASSESSMENT_READ_PERMISSIONS);
}

export function userCanManageAssessmentPlans(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, ASSESSMENT_PLAN_MANAGE_PERMISSIONS);
}

export function userCanScoreAssessments(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, ASSESSMENT_SCORE_PERMISSIONS);
}

export function userCanAttachAssessmentEvidence(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, ASSESSMENT_EVIDENCE_PERMISSIONS);
}

export function userCanModerateAssessments(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, ASSESSMENT_MODERATE_PERMISSIONS);
}

export function userCanReleaseAssessments(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, ASSESSMENT_RELEASE_PERMISSIONS);
}

export function assessmentAccessMatrix() {
  return ROLES.map((role) => ({
    role,
    read: roleHasAny(role, ASSESSMENT_READ_PERMISSIONS),
    managePlans: roleHasAny(role, ASSESSMENT_PLAN_MANAGE_PERMISSIONS),
    score: roleHasAny(role, ASSESSMENT_SCORE_PERMISSIONS),
    attachEvidence: roleHasAny(role, ASSESSMENT_EVIDENCE_PERMISSIONS),
    moderate: roleHasAny(role, ASSESSMENT_MODERATE_PERMISSIONS),
    release: roleHasAny(role, ASSESSMENT_RELEASE_PERMISSIONS),
  }));
}
