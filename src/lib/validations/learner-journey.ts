/**
 * PART J.8 — Learning Journey Timeline validation + access rules.
 *
 * Protects the unified learner timeline query layer without introducing a new
 * duplicate learner-history database subsystem. J.8 aggregates existing modules
 * (exams, assessments, attendance, discipline, competencies, skills passport,
 * portfolio, certificates) into one ordered timeline.
 */
import { z } from "zod";
import { can, type Permission } from "@/lib/core/permissions";
import { ROLES, type Role } from "@/lib/core/roles";
import type { SessionUser } from "@/lib/core/session";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalDateYmd = z.union([dateYmd, z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined));
const optionalText = (max = 500) => z.union([z.string().trim().max(max), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined));

export const LEARNER_JOURNEY_MODES = ["staff", "parent"] as const;
export const LEARNER_JOURNEY_SOURCES = [
  "EXAM",
  "ASSESSMENT",
  "ATTENDANCE",
  "DISCIPLINE",
  "COMPETENCY",
  "SKILLS",
  "PORTFOLIO",
  "CERTIFICATE",
  "SYSTEM",
] as const;
export const LEARNER_JOURNEY_VISIBILITY = ["STAFF", "PARENT_SAFE"] as const;
export const LEARNER_JOURNEY_VERIFICATION = ["VERIFIED", "PENDING", "NOT_REQUIRED"] as const;

export const LEARNER_JOURNEY_READ_PERMISSIONS = ["academics.view", "exam.view", "student.view"] as const satisfies readonly Permission[];
export const LEARNER_JOURNEY_STAFF_VIEW_PERMISSIONS = ["academics.view", "exam.view", "student.view"] as const satisfies readonly Permission[];
export const LEARNER_JOURNEY_PIN_PERMISSIONS = ["academics.manage", "exam.enter_marks", "exam.publish", "student.edit"] as const satisfies readonly Permission[];

export const learnerJourneyQuerySchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  mode: z.enum(LEARNER_JOURNEY_MODES).default("staff"),
  from: optionalDateYmd,
  to: optionalDateYmd,
  source: z.union([z.enum(LEARNER_JOURNEY_SOURCES), z.literal("ALL"), z.literal(""), z.null()]).optional().transform((value) => (value && value !== "ALL" ? value : undefined)),
  limit: z.coerce.number().int().min(1).max(200).default(60),
}).strict().refine((value) => {
  if (!value.from || !value.to) return true;
  return value.from <= value.to;
}, {
  message: "The end date cannot be before the start date.",
  path: ["to"],
});
export type LearnerJourneyQueryInput = z.input<typeof learnerJourneyQuerySchema>;

export const learnerJourneyEntrySchema = z.object({
  id: z.string().min(1),
  date: dateYmd,
  sourceModule: z.enum(LEARNER_JOURNEY_SOURCES),
  eventType: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().min(2).max(400),
  status: optionalText(40),
  href: z.union([z.string().trim().url(), z.string().trim().startsWith("/"), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined)),
  visibility: z.enum(LEARNER_JOURNEY_VISIBILITY),
  verificationStatus: z.enum(LEARNER_JOURNEY_VERIFICATION).default("NOT_REQUIRED"),
}).strict();
export type LearnerJourneyEntryInput = z.input<typeof learnerJourneyEntrySchema>;

export const learnerJourneyPinSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  entryId: z.string().trim().min(1, "entryId is required").max(120),
  sourceModule: z.enum(LEARNER_JOURNEY_SOURCES),
  sourceRecordId: optionalText(120),
  note: optionalText(280),
  visibility: z.enum(LEARNER_JOURNEY_VISIBILITY).default("STAFF"),
}).strict();
export type LearnerJourneyPinInput = z.input<typeof learnerJourneyPinSchema>;

export const learnerJourneyUnpinSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  entryId: z.string().trim().min(1, "entryId is required").max(120),
}).strict();
export type LearnerJourneyUnpinInput = z.input<typeof learnerJourneyUnpinSchema>;

function roleHasAny(role: Role, permissions: readonly Permission[]) {
  return permissions.some((permission) => can(role, permission));
}

function userHasAnyPermission(user: Pick<SessionUser, "role" | "secondaryRole">, permissions: readonly Permission[]) {
  return roleHasAny(user.role, permissions) || (!!user.secondaryRole && roleHasAny(user.secondaryRole, permissions));
}

function roleIsParentOrStudent(role: Role | null | undefined) {
  return role === "PARENT" || role === "STUDENT";
}

export function userCanReadLearnerJourney(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, LEARNER_JOURNEY_READ_PERMISSIONS);
}

export function userCanReadStaffLearnerJourney(user: Pick<SessionUser, "role" | "secondaryRole">) {
  const hasStaffIdentity = !roleIsParentOrStudent(user.role) || (!!user.secondaryRole && !roleIsParentOrStudent(user.secondaryRole));
  return hasStaffIdentity && userHasAnyPermission(user, LEARNER_JOURNEY_STAFF_VIEW_PERMISSIONS);
}

export function userCanReadParentSafeLearnerJourney(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userCanReadLearnerJourney(user);
}

export function userCanPinLearnerJourney(user: Pick<SessionUser, "role" | "secondaryRole">) {
  const hasStaffIdentity = !roleIsParentOrStudent(user.role) || (!!user.secondaryRole && !roleIsParentOrStudent(user.secondaryRole));
  return hasStaffIdentity && userHasAnyPermission(user, LEARNER_JOURNEY_PIN_PERMISSIONS);
}

export function userCanAccessLearnerJourneyMode(user: Pick<SessionUser, "role" | "secondaryRole">, mode: (typeof LEARNER_JOURNEY_MODES)[number]) {
  return mode === "staff" ? userCanReadStaffLearnerJourney(user) : userCanReadParentSafeLearnerJourney(user);
}

export function learnerJourneyAccessMatrix() {
  return ROLES.map((role) => ({
    role,
    readAny: roleHasAny(role, LEARNER_JOURNEY_READ_PERMISSIONS),
    readStaff: !roleIsParentOrStudent(role) && roleHasAny(role, LEARNER_JOURNEY_STAFF_VIEW_PERMISSIONS),
    readParentSafe: roleHasAny(role, LEARNER_JOURNEY_READ_PERMISSIONS),
    pinMilestones: !roleIsParentOrStudent(role) && roleHasAny(role, LEARNER_JOURNEY_PIN_PERMISSIONS),
  }));
}
