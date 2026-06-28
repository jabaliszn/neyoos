/**
 * PART J.5 — Rubrics & Evidence validation + access rules.
 *
 * Protects configurable rubric definitions, levels, scoring actions and evidence
 * attachments. Replaces temporary rubricJson structures with formal definitions
 * without duplicating exam/CBC grading.
 */
import { z } from "zod";
import { can, type Permission } from "@/lib/core/permissions";
import { ROLES, type Role } from "@/lib/core/roles";
import type { SessionUser } from "@/lib/core/session";

const optionalId = z.union([z.string().min(1), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined));
const optionalText = (max = 1000) => z.union([z.string().trim().max(max), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined));
const safeName = z
  .string()
  .trim()
  .min(2, "Name is too short")
  .max(120, "Name is too long")
  .regex(/^[\p{L}\p{N}\s'’().,&/+:-]+$/u, "Use letters, numbers and simple punctuation only");
const code = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dash or underscore only")
  .transform((value) => value.toUpperCase());

export const RUBRIC_CATEGORIES = ["CBC", "PROJECT", "PRACTICAL", "PORTFOLIO", "COMPETENCY", "GENERAL"] as const;

export const RUBRIC_READ_PERMISSIONS = ["academics.view", "exam.view", "student.view"] as const satisfies readonly Permission[];
export const RUBRIC_MANAGE_PERMISSIONS = ["academics.manage", "tenant.manage_settings"] as const satisfies readonly Permission[];
export const RUBRIC_SCORE_PERMISSIONS = ["exam.enter_marks", "homework.assign", "academics.manage"] as const satisfies readonly Permission[];

export const rubricLevelSchema = z.object({
  level: z.coerce.number().int().min(1).max(20),
  code,
  label: safeName,
  descriptor: optionalText(1500),
  points: z.coerce.number().min(0).max(1000).nullable().optional(),
}).strict();
export type RubricLevelInput = z.input<typeof rubricLevelSchema>;
export type RubricLevelParsed = z.output<typeof rubricLevelSchema>;

function levelsAreUnique(levels: { level: number; code: string }[]) {
  const levelSet = new Set(levels.map((l) => l.level));
  const codeSet = new Set(levels.map((l) => l.code));
  return levelSet.size === levels.length && codeSet.size === levels.length;
}

const rubricFields = z.object({
  name: safeName,
  description: optionalText(1000),
  category: z.enum(RUBRIC_CATEGORIES).default("GENERAL"),
  isArchived: z.boolean().default(false),
  levels: z.array(rubricLevelSchema).min(1, "Add at least one rubric level").refine(levelsAreUnique, {
    message: "Each rubric level number and code must be unique within the rubric.",
    path: ["levels"],
  }),
}).strict();

export const rubricSchema = rubricFields;
export const rubricUpdateSchema = z.object({
  id: z.string().min(1),
  name: safeName.optional(),
  description: optionalText(1000),
  category: z.enum(RUBRIC_CATEGORIES).optional(),
  isArchived: z.boolean().optional(),
  levels: z.array(rubricLevelSchema).min(1, "Add at least one rubric level").refine(levelsAreUnique, {
    message: "Each rubric level number and code must be unique within the rubric.",
    path: ["levels"],
  }).optional(),
}).strict();
export type RubricInput = z.input<typeof rubricSchema>;
export type RubricUpdateInput = z.input<typeof rubricUpdateSchema>;

export const attachRubricSchema = z.object({
  rubricId: z.string().min(1),
  targetType: z.enum(["assessment_type", "assessment_plan", "competency"]),
  targetId: z.string().min(1),
}).strict();
export type AttachRubricInput = z.input<typeof attachRubricSchema>;

export const scoreWithRubricSchema = z.object({
  targetType: z.enum(["assessment_record", "competency_evidence"]),
  targetId: z.string().min(1),
  rubricId: z.string().min(1),
  rubricLevel: z.coerce.number().int().min(1).max(20),
  rubricCode: code,
  points: z.coerce.number().min(0).max(1000).nullable().optional(),
  narrative: optionalText(2500),
}).strict();
export type ScoreWithRubricInput = z.input<typeof scoreWithRubricSchema>;

export const attachRubricEvidenceSchema = z.object({
  targetType: z.enum(["assessment_record", "competency_evidence"]),
  targetId: z.string().min(1),
  storedFileId: z.string().min(1),
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  contentType: optionalText(100),
  evidenceType: z.enum(["FILE", "LINK", "NOTE", "PHOTO", "VIDEO", "CERTIFICATE"]).default("FILE"),
  note: optionalText(1000),
}).strict();
export type AttachRubricEvidenceInput = z.input<typeof attachRubricEvidenceSchema>;

export const rubricActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("seed_defaults"), payload: z.object({}).default({}) }).strict(),
  z.object({ action: z.literal("create_rubric"), payload: rubricSchema }).strict(),
  z.object({ action: z.literal("update_rubric"), payload: rubricUpdateSchema }).strict(),
  z.object({ action: z.literal("archive_rubric"), payload: z.object({ id: z.string().min(1), isArchived: z.boolean().default(true) }).strict() }).strict(),
  z.object({ action: z.literal("attach_rubric"), payload: attachRubricSchema }).strict(),
  z.object({ action: z.literal("score_with_rubric"), payload: scoreWithRubricSchema }).strict(),
  z.object({ action: z.literal("attach_evidence_file"), payload: attachRubricEvidenceSchema }).strict(),
]);
export type RubricActionInput = z.input<typeof rubricActionSchema>;

function roleHasAny(role: Role, permissions: readonly Permission[]) {
  return permissions.some((permission) => can(role, permission));
}

function userHasAnyPermission(user: Pick<SessionUser, "role" | "secondaryRole">, permissions: readonly Permission[]) {
  return roleHasAny(user.role, permissions) || (!!user.secondaryRole && roleHasAny(user.secondaryRole, permissions));
}

export function userCanReadRubrics(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, RUBRIC_READ_PERMISSIONS);
}

export function userCanManageRubrics(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, RUBRIC_MANAGE_PERMISSIONS);
}

export function userCanScoreWithRubrics(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, RUBRIC_SCORE_PERMISSIONS);
}

export function rubricAccessMatrix() {
  return ROLES.map((role) => ({
    role,
    read: roleHasAny(role, RUBRIC_READ_PERMISSIONS),
    manage: roleHasAny(role, RUBRIC_MANAGE_PERMISSIONS),
    score: roleHasAny(role, RUBRIC_SCORE_PERMISSIONS),
  }));
}
