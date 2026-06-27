/**
 * PART J.2 — Curriculum Engine validation + access rules.
 *
 * WHAT: Zod schemas for configurable curricula, levels, grade names and learning
 * areas. These schemas keep the Education OS configurable instead of hardcoding
 * one curriculum into the product.
 *
 * SECURITY: curriculum setup is school configuration + academic structure. A user
 * may manage it when they hold either `tenant.manage_settings` or
 * `academics.manage` through their primary or secondary role. Read access is for
 * academics viewers and settings managers. API routes will still call the normal
 * session guards first; these helpers document the exact role rules for all 16
 * roles and are tested in `scripts/j2-curriculum-validation-test.ts`.
 */
import { z } from "zod";
import { can, type Permission } from "@/lib/core/permissions";
import { ROLES, type Role } from "@/lib/core/roles";
import type { SessionUser } from "@/lib/core/session";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalDateYmd = z
  .union([dateYmd, z.literal("")])
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const optionalText = (max = 500) =>
  z
    .union([z.string().trim().max(max), z.literal("")])
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const optionalId = z
  .union([z.string().min(1), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : undefined));

const sequence = z.coerce.number().int().min(1).max(1000);
const safeName = z
  .string()
  .trim()
  .min(2, "Name is too short")
  .max(90, "Name is too long")
  .regex(/^[\p{L}\p{N}\s'’().,&/+:-]+$/u, "Use letters, numbers and simple punctuation only");

const code = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dash or underscore only")
  .transform((value) => value.toUpperCase());

export const CURRICULUM_READ_PERMISSIONS = ["academics.view", "tenant.manage_settings"] as const satisfies readonly Permission[];
export const CURRICULUM_MANAGE_PERMISSIONS = ["academics.manage", "tenant.manage_settings"] as const satisfies readonly Permission[];

export const EDUCATION_LEVEL_KEYS = [
  "preschool",
  "primary",
  "junior",
  "senior",
  "forms",
  "college",
  "university",
  "custom",
] as const;

const curriculumFields = z
  .object({
    name: safeName,
    country: z.string().trim().min(2).max(60).default("Kenya"),
    context: optionalText(160),
    activeVersion: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[\p{L}\p{N}\s._/-]+$/u, "Use a clear version label, e.g. 2026, CBC-2027 or v1"),
    effectiveFrom: optionalDateYmd,
    effectiveTo: optionalDateYmd,
    isActive: z.boolean().default(true),
    notes: optionalText(1000),
  })
  .strict();

function dateRangeIsValid(value: { effectiveFrom?: string; effectiveTo?: string }) {
  return !value.effectiveFrom || !value.effectiveTo || value.effectiveTo >= value.effectiveFrom;
}

export const curriculumSchema = curriculumFields.refine(dateRangeIsValid, {
  message: "Effective end date must be on or after the start date.",
  path: ["effectiveTo"],
});

export const curriculumUpdateSchema = curriculumFields
  .partial()
  .extend({ id: z.string().min(1) })
  .strict()
  .refine(dateRangeIsValid, {
    message: "Effective end date must be on or after the start date.",
    path: ["effectiveTo"],
  });
export type CurriculumInput = z.infer<typeof curriculumSchema>;
export type CurriculumUpdateInput = z.infer<typeof curriculumUpdateSchema>;

export const educationLevelSchema = z
  .object({
    curriculumId: z.string().min(1),
    name: safeName,
    levelKey: z.enum(EDUCATION_LEVEL_KEYS).default("custom"),
    sequence,
    description: optionalText(500),
  })
  .strict();

export const educationLevelUpdateSchema = educationLevelSchema.partial().extend({ id: z.string().min(1) }).strict();
export type EducationLevelInput = z.infer<typeof educationLevelSchema>;
export type EducationLevelUpdateInput = z.infer<typeof educationLevelUpdateSchema>;

const gradeBandFields = z
  .object({
    curriculumId: z.string().min(1),
    educationLevelId: optionalId,
    name: safeName, // PP1, Grade 1, Form 1, Year 7, custom school names.
    shortName: optionalText(20),
    sequence,
    entryAge: z.coerce.number().int().min(2).max(40).optional(),
    exitAge: z.coerce.number().int().min(2).max(45).optional(),
  })
  .strict();

function ageRangeIsValid(value: { entryAge?: number; exitAge?: number }) {
  return !value.entryAge || !value.exitAge || value.exitAge >= value.entryAge;
}

export const gradeBandSchema = gradeBandFields.refine(ageRangeIsValid, {
  message: "Exit age must be greater than or equal to entry age.",
  path: ["exitAge"],
});

export const gradeBandUpdateSchema = gradeBandFields
  .partial()
  .extend({ id: z.string().min(1) })
  .strict()
  .refine(ageRangeIsValid, {
    message: "Exit age must be greater than or equal to entry age.",
    path: ["exitAge"],
  });
export type GradeBandInput = z.infer<typeof gradeBandSchema>;
export type GradeBandUpdateInput = z.infer<typeof gradeBandUpdateSchema>;

export const learningAreaSchema = z
  .object({
    curriculumId: z.string().min(1),
    name: safeName,
    code,
    description: optionalText(700),
  })
  .strict();

export const learningAreaUpdateSchema = learningAreaSchema.partial().extend({ id: z.string().min(1) }).strict();
export type LearningAreaInput = z.infer<typeof learningAreaSchema>;
export type LearningAreaUpdateInput = z.infer<typeof learningAreaUpdateSchema>;

export const subjectCurriculumMappingSchema = z
  .object({
    subjectId: z.string().min(1),
    curriculumId: optionalId,
    learningAreaId: optionalId,
  })
  .strict();

export const classCurriculumMappingSchema = z
  .object({
    classId: z.string().min(1),
    curriculumId: optionalId,
    gradeBandId: optionalId,
  })
  .strict();

export const termCurriculumMappingSchema = z
  .object({
    termId: z.string().min(1),
    curriculumId: optionalId,
  })
  .strict();

export const strandLearningAreaMappingSchema = z
  .object({
    strandId: z.string().min(1),
    learningAreaId: optionalId,
  })
  .strict();

export const curriculumMappingsSchema = z
  .object({
    subjects: z.array(subjectCurriculumMappingSchema).max(500).default([]),
    classes: z.array(classCurriculumMappingSchema).max(500).default([]),
    terms: z.array(termCurriculumMappingSchema).max(50).default([]),
    strands: z.array(strandLearningAreaMappingSchema).max(1000).default([]),
  })
  .strict();

export type CurriculumMappingsInput = z.infer<typeof curriculumMappingsSchema>;

export const curriculumActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_curriculum"), payload: curriculumSchema }).strict(),
  z.object({ action: z.literal("update_curriculum"), payload: curriculumUpdateSchema }).strict(),
  z.object({ action: z.literal("create_level"), payload: educationLevelSchema }).strict(),
  z.object({ action: z.literal("update_level"), payload: educationLevelUpdateSchema }).strict(),
  z.object({ action: z.literal("create_grade_band"), payload: gradeBandSchema }).strict(),
  z.object({ action: z.literal("update_grade_band"), payload: gradeBandUpdateSchema }).strict(),
  z.object({ action: z.literal("create_learning_area"), payload: learningAreaSchema }).strict(),
  z.object({ action: z.literal("update_learning_area"), payload: learningAreaUpdateSchema }).strict(),
  z.object({ action: z.literal("map_existing_records"), payload: curriculumMappingsSchema }).strict(),
  z.object({ action: z.literal("run_migration_assistant"), payload: z.object({}).default({}) }).strict(),
]);

export type CurriculumActionInput = z.infer<typeof curriculumActionSchema>;

function roleHasAny(role: Role, permissions: readonly Permission[]) {
  return permissions.some((permission) => can(role, permission));
}

function userHasAnyPermission(user: Pick<SessionUser, "role" | "secondaryRole">, permissions: readonly Permission[]) {
  return roleHasAny(user.role, permissions) || (!!user.secondaryRole && roleHasAny(user.secondaryRole, permissions));
}

export function userCanReadCurriculum(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, CURRICULUM_READ_PERMISSIONS);
}

export function userCanManageCurriculum(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, CURRICULUM_MANAGE_PERMISSIONS);
}

export function curriculumAccessMatrix() {
  return ROLES.map((role) => ({
    role,
    read: roleHasAny(role, CURRICULUM_READ_PERMISSIONS),
    manage: roleHasAny(role, CURRICULUM_MANAGE_PERMISSIONS),
  }));
}
