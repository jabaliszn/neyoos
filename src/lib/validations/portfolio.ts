/**
 * PART J.7 — Student Portfolio System validation + access rules.
 *
 * Protects learner portfolio items, media size limits, encrypted Storage Vault
 * references and teacher approval workflows. This layer is curriculum-independent
 * and keeps creative student work decoupled from administrative files.
 */
import { z } from "zod";
import { can, type Permission } from "@/lib/core/permissions";
import { ROLES, type Role } from "@/lib/core/roles";
import type { SessionUser } from "@/lib/core/session";

const optionalId = z.union([z.string().min(1), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined));
const optionalText = (max = 1000) => z.union([z.string().trim().max(max), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined));
const safeTitle = z
  .string()
  .trim()
  .min(2, "Title is too short")
  .max(120, "Title is too long")
  .regex(/^[\p{L}\p{N}\s'’().,&/+:-]+$/u, "Use letters, numbers and simple punctuation only");

export const PORTFOLIO_CATEGORIES = ["PROJECT", "VIDEO", "PHOTO", "ART", "CODING", "CERTIFICATE", "OBSERVATION", "COMMUNITY"] as const;

export const PORTFOLIO_READ_PERMISSIONS = ["academics.view", "exam.view", "student.view"] as const satisfies readonly Permission[];
export const PORTFOLIO_SUBMIT_PERMISSIONS = ["exam.enter_marks", "homework.assign", "academics.manage"] as const satisfies readonly Permission[];
export const PORTFOLIO_APPROVE_PERMISSIONS = ["exam.publish", "academics.manage"] as const satisfies readonly Permission[];

// 50 MB hard cap for portfolio media size control
export const MAX_PORTFOLIO_FILE_SIZE_BYTES = 50 * 1024 * 1024;
// 10 MB threshold for displaying storage usage warning
export const STORAGE_WARNING_THRESHOLD_BYTES = 10 * 1024 * 1024;

const portfolioItemFields = z.object({
  studentId: z.string().min(1),
  title: safeTitle,
  category: z.enum(PORTFOLIO_CATEGORIES).default("PROJECT"),
  description: optionalText(1500),
  storedFileId: optionalId,
  fileUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined)),
  fileName: optionalText(200),
  fileSizeBytes: z.coerce.number().int().min(0).max(MAX_PORTFOLIO_FILE_SIZE_BYTES, "File size exceeds the 50 MB portfolio limit").nullable().optional(),
  externalLink: z.union([z.string().url(), z.literal(""), z.null()]).optional().transform((value) => (value ? value : undefined)),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).default("SUBMITTED"),
  visibleToParents: z.boolean().default(false),
  competencyId: optionalId,
  subjectId: optionalId,
  clubId: optionalId,
  awardId: optionalId,
}).strict();

function hasContentOrLink(value: { storedFileId?: string; fileUrl?: string; externalLink?: string; description?: string }) {
  return Boolean(value.storedFileId || value.fileUrl || value.externalLink || value.description);
}

export const portfolioItemSchema = portfolioItemFields.refine(hasContentOrLink, {
  message: "Provide an encrypted file upload, external project link, or detailed description.",
  path: ["description"],
});

export const portfolioItemUpdateSchema = portfolioItemFields
  .partial()
  .extend({ id: z.string().min(1) })
  .strict()
  .refine(hasContentOrLink, {
    message: "Provide an encrypted file upload, external project link, or detailed description.",
    path: ["description"],
  });

export type PortfolioItemInput = z.input<typeof portfolioItemSchema>;
export type PortfolioItemUpdateInput = z.input<typeof portfolioItemUpdateSchema>;

export const portfolioApprovalSchema = z.object({
  itemId: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
  visibleToParents: z.boolean().default(true),
  note: optionalText(700),
}).strict();
export type PortfolioApprovalInput = z.input<typeof portfolioApprovalSchema>;

export const portfolioActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit_item"), payload: portfolioItemSchema }).strict(),
  z.object({ action: z.literal("update_item"), payload: portfolioItemUpdateSchema }).strict(),
  z.object({ action: z.literal("approve_item"), payload: portfolioApprovalSchema }).strict(),
  z.object({ action: z.literal("reject_item"), payload: portfolioApprovalSchema }).strict(),
  z.object({ action: z.literal("delete_item"), payload: z.object({ id: z.string().min(1) }).strict() }).strict(),
]);
export type PortfolioActionInput = z.input<typeof portfolioActionSchema>;

function roleHasAny(role: Role, permissions: readonly Permission[]) {
  return permissions.some((permission) => can(role, permission));
}

function userHasAnyPermission(user: Pick<SessionUser, "role" | "secondaryRole">, permissions: readonly Permission[]) {
  return roleHasAny(user.role, permissions) || (!!user.secondaryRole && roleHasAny(user.secondaryRole, permissions));
}

export function userCanReadPortfolio(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, PORTFOLIO_READ_PERMISSIONS);
}

export function userCanSubmitPortfolio(user: Pick<SessionUser, "role" | "secondaryRole">) {
  // Allow students to submit their own portfolio items
  if (user.role === "STUDENT") return true;
  return userHasAnyPermission(user, PORTFOLIO_SUBMIT_PERMISSIONS);
}

export function userCanApprovePortfolio(user: Pick<SessionUser, "role" | "secondaryRole">) {
  return userHasAnyPermission(user, PORTFOLIO_APPROVE_PERMISSIONS);
}

export function portfolioAccessMatrix() {
  return ROLES.map((role) => ({
    role,
    read: roleHasAny(role, PORTFOLIO_READ_PERMISSIONS),
    submit: role === "STUDENT" || roleHasAny(role, PORTFOLIO_SUBMIT_PERMISSIONS),
    approve: roleHasAny(role, PORTFOLIO_APPROVE_PERMISSIONS),
  }));
}
