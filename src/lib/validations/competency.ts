/**
 * PART J.4 — Competency Framework validation + access rules.
 *
 * Protects configurable competency groups, competencies and learner evidence.
 * This layer is curriculum-independent and can use CBC/J.3 records as evidence
 * sources without duplicating those modules.
 */
import { z } from "zod";
import { can, type Permission } from "@/lib/core/permissions";
import { ROLES, type Role } from "@/lib/core/roles";
import type { SessionUser } from "@/lib/core/session";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalId = z.union([z.string().min(1), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined));
const optionalText = (max = 1000) => z.union([z.string().trim().max(max), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined));
const sequence = z.coerce.number().int().min(1).max(1000).default(1);
const safeName = z
  .string()
  .trim()
  .min(2, "Name is too short")
  .max(120, "Name is too long")
  .regex(/^[\p{L}\p{N}\s'’().,&/+:-]+$/u, "Use letters, numbers and simple punctuation only");
const code = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dash or underscore only")
  .transform((value) => value.toUpperCase());

export const COMPETENCY_SOURCE_MODULES = ["CBC", "ASSESSMENT", "LMS", "MANUAL", "CLUB", "PORTFOLIO"] as const;

export const COMPETENCY_READ_PERMISSIONS = ["academics.view", "exam.view", "student.view"] as const satisfies readonly Permission[];
export const COMPETENCY_MANAGE_PERMISSIONS = ["academics.manage", "tenant.manage_settings"] as const satisfies readonly Permission[];
export const COMPETENCY_EVIDENCE_PERMISSIONS = ["exam.enter_marks", "homework.assign", "academics.manage"] as const satisfies readonly Permission[];
export const COMPETENCY_APPROVE_PERMISSIONS = ["exam.publish"] as const satisfies readonly Permission[];

const competencyGroupFields = z.object({
  curriculumId: optionalId,
  name: safeName,
  code,
  description: optionalText(700),
  sequence,
  active: z.boolean().default(true),
}).strict();

export const competencyGroupSchema = competencyGroupFields;
export const competencyGroupUpdateSchema = competencyGroupFields.partial().extend({ id: z.string().min(1) }).strict();
export type CompetencyGroupInput = z.input<typeof competencyGroupSchema>;
export type CompetencyGroupUpdateInput = z.input<typeof competencyGroupUpdateSchema>;

const competencyFields = z.object({
  groupId: optionalId,
  curriculumId: optionalId,
  learningAreaId: optionalId,
  name: safeName,
  code,
  description: optionalText(1000),
  sequence,
  active: z.boolean().default(true),
}).strict();

export const competencySchema = competencyFields;
export const competencyUpdateSchema = competencyFields.partial().extend({ id: z.string().min(1) }).strict();
export type CompetencyInput = z.input<typeof competencySchema>;
export type CompetencyUpdateInput = z.input<typeof competencyUpdateSchema>;

const competencyEvidenceFields = z.object({
  competencyId: z.string().min(1),
  studentId: z.string().min(1),
  sourceModule: z.enum(COMPETENCY_SOURCE_MODULES).default("MANUAL"),
  sourceId: optionalId,
  assessmentRecordId: optionalId,
  cbcAssessmentId: optionalId,
  level: z.coerce.number().int().min(1).max(4).optional(),
  scorePct: z.coerce.number().int().min(0).max(100).optional(),
  narrative: optionalText(2500),
  evidenceDate: dateYmd,
  approved: z.boolean().default(false),
  visibleToParents: z.boolean().default(false),
}).strict();

function evidenceHasAssessment(value: { level?: number; scorePct?: number; narrative?: string }) {
  return value.level !== undefined || value.scorePct !== undefined || Boolean(value.narrative);
}

function evidenceSourceIsConsistent(value: { sourceModule?: string; assessmentRecordId?: string; cbcAssessmentId?: string }) {
  if (value.assessmentRecordId && value.sourceModule && value.sourceModule !== "ASSESSMENT") return false;
  if (value.cbcAssessmentId && value.sourceModule && value.sourceModule !== "CBC") return false;
  return true;
}

export const competencyEvidenceSchema = competencyEvidenceFields
  .refine(evidenceHasAssessment, {
    message: "Add a competency level, percentage or narrative evidence.",
    path: ["level"],
  })
  .refine(evidenceSourceIsConsistent, {
    message: "Assessment records must use source ASSESSMENT; CBC observations must use source CBC.",
    path: ["sourceModule"],
  });

export const competencyEvidenceUpdateSchema = competencyEvidenceFields
  .partial()
  .extend({ id: z.string().min(1) })
  .strict()
  .refine(evidenceHasAssessment, {
    message: "Add a competency level, percentage or narrative evidence.",
    path: ["level"],
  })
  .refine(evidenceSourceIsConsistent, {
    message: "Assessment records must use source ASSESSMENT; CBC observations must use source CBC.",
    path: ["sourceModule"],
  });
export type CompetencyEvidenceInput = z.input<typeof competencyEvidenceSchema>;
export type CompetencyEvidenceUpdateInput = z.input<typeof competencyEvidenceUpdateSchema>;

export const competencyEvidenceApprovalSchema = z.object({
  evidenceId: z.string().min(1),
  approved: z.boolean().default(true),
  visibleToParents: z.boolean().default(false),
  note: optionalText(700),
}).strict();
export type CompetencyEvidenceApprovalInput = z.input<typeof competencyEvidenceApprovalSchema>;

export const competencyActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("seed_defaults"), payload: z.object({}).default({}) }).strict(),
  z.object({ action: z.literal("create_group"), payload: competencyGroupSchema }).strict(),
  z.object({ action: z.literal("update_group"), payload: competencyGroupUpdateSchema }).strict(),
  z.object({ action: z.literal("create_competency"), payload: competencySchema }).strict(),
  z.object({ action: z.literal("update_competency"), payload: competencyUpdateSchema }).strict(),
  z.object({ action: z.literal("record_evidence"), payload: competencyEvidenceSchema }).strict(),
  z.object({ action: z.literal("update_evidence"), payload: competencyEvidenceUpdateSchema }).strict(),
  z.object({ action: z.literal("approve_evidence"), payload: competencyEvidenceApprovalSchema }).strict(),
]);
export type CompetencyActionInput = z.input<typeof competencyActionSchema>;

function roleHasAny(role: Role, permissions: readonly Permission[]) {
  return permissions.some((permission) => can(role, permission));
}

function userHasAnyPermission(user: Pick<SessionUser, "role" | "secondaryRole">, permissions: readonly Permission[]) {
  return roleHasAny(user.role, permissions) || (!!user.secondaryRole && roleHasAny(user.secondaryRole, permissions));
}

export function userCanReadCompetencies(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, COMPETENCY_READ_PERMISSIONS);
}

export function userCanManageCompetencies(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, COMPETENCY_MANAGE_PERMISSIONS);
}

export function userCanRecordCompetencyEvidence(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, COMPETENCY_EVIDENCE_PERMISSIONS);
}

export function userCanApproveCompetencyEvidence(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, COMPETENCY_APPROVE_PERMISSIONS);
}

export function competencyAccessMatrix() {
  return ROLES.map((role) => ({
    role,
    read: roleHasAny(role, COMPETENCY_READ_PERMISSIONS),
    manage: roleHasAny(role, COMPETENCY_MANAGE_PERMISSIONS),
    recordEvidence: roleHasAny(role, COMPETENCY_EVIDENCE_PERMISSIONS),
    approveEvidence: roleHasAny(role, COMPETENCY_APPROVE_PERMISSIONS),
  }));
}
