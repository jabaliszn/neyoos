/**
 * PART J.6 — Skills Passport validation + access rules.
 *
 * Protects learner Skills Passport entries, skill ratings (Leadership, Coding,
 * Music, Sports, Creativity) and evidence sources. This layer is curriculum-independent
 * and provides portable student growth verification.
 */
import { z } from "zod";
import { can, type Permission } from "@/lib/core/permissions";
import { ROLES, type Role } from "@/lib/core/roles";
import type { SessionUser } from "@/lib/core/session";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalId = z.union([z.string().min(1), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined));
const optionalText = (max = 1000) => z.union([z.string().trim().max(max), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined));
const safeName = z
  .string()
  .trim()
  .min(2, "Name is too short")
  .max(120, "Name is too long")
  .regex(/^[\p{L}\p{N}\s'’().,&/+:-]+$/u, "Use letters, numbers and simple punctuation only");

export const SKILL_AREAS = ["Leadership", "Communication", "Coding", "Music", "Sports", "Creativity"] as const;
export const EVIDENCE_SOURCES = ["ASSESSMENT", "CLUB", "PORTFOLIO", "AWARD", "OBSERVATION"] as const;

export const SKILLS_PASSPORT_READ_PERMISSIONS = ["academics.view", "exam.view", "student.view"] as const satisfies readonly Permission[];
export const SKILLS_PASSPORT_RECORD_PERMISSIONS = ["exam.enter_marks", "homework.assign", "academics.manage"] as const satisfies readonly Permission[];

const skillsPassportEntryFields = z.object({
  studentId: z.string().min(1),
  skillArea: z.union([z.enum(SKILL_AREAS), safeName]),
  ratingLevel: z.coerce.number().int().min(1).max(5),
  evidenceSource: z.enum(EVIDENCE_SOURCES).default("OBSERVATION"),
  sourceId: optionalId,
  narrative: optionalText(2500),
  evidenceDate: dateYmd,
  verified: z.boolean().default(true),
}).strict();

export const skillsPassportEntrySchema = skillsPassportEntryFields;
export const skillsPassportEntryUpdateSchema = skillsPassportEntryFields.partial().extend({ id: z.string().min(1) }).strict();
export type SkillsPassportEntryInput = z.input<typeof skillsPassportEntrySchema>;
export type SkillsPassportEntryUpdateInput = z.input<typeof skillsPassportEntryUpdateSchema>;

export const skillsPassportActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("record_skill_rating"), payload: skillsPassportEntrySchema }).strict(),
  z.object({ action: z.literal("remove_skill_rating"), payload: z.object({ id: z.string().min(1) }).strict() }).strict(),
]);
export type SkillsPassportActionInput = z.input<typeof skillsPassportActionSchema>;

function roleHasAny(role: Role, permissions: readonly Permission[]) {
  return permissions.some((permission) => can(role, permission));
}

function userHasAnyPermission(user: Pick<SessionUser, "role" | "secondaryRole">, permissions: readonly Permission[]) {
  return roleHasAny(user.role, permissions) || (!!user.secondaryRole && roleHasAny(user.secondaryRole, permissions));
}

export function userCanReadSkillsPassport(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, SKILLS_PASSPORT_READ_PERMISSIONS);
}

export function userCanRecordSkillsPassport(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, SKILLS_PASSPORT_RECORD_PERMISSIONS);
}

export function skillsPassportAccessMatrix() {
  return ROLES.map((role) => ({
    role,
    read: roleHasAny(role, SKILLS_PASSPORT_READ_PERMISSIONS),
    record: roleHasAny(role, SKILLS_PASSPORT_RECORD_PERMISSIONS),
  }));
}
