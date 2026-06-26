/**
 * NEYO — The 16 Roles (Feature A.3).
 * Canonical, single source of truth. Zod schemas + permission matrix import from here.
 */
export const ROLES = [
  "SUPER_ADMIN", // NEYO platform staff
  "SCHOOL_OWNER", // director / proprietor
  "PRINCIPAL", // head teacher
  "DEPUTY_PRINCIPAL",
  "DEAN_OF_STUDIES",
  "HOD", // head of department
  "TEACHER",
  "CLASS_TEACHER",
  "BURSAR", // finance
  "ACCOUNTANT",
  "RECEPTIONIST", // front office
  "LIBRARIAN",
  "HOSTEL_MASTER",
  "SUPPORT_STAFF",
  "PARENT",
  "STUDENT",
] as const;

export type Role = (typeof ROLES)[number];

/** Human-readable labels for the UI. */
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "NEYO Admin",
  SCHOOL_OWNER: "School Owner",
  PRINCIPAL: "Principal",
  DEPUTY_PRINCIPAL: "Deputy Principal",
  DEAN_OF_STUDIES: "Dean of Studies",
  HOD: "Head of Department",
  TEACHER: "Teacher",
  CLASS_TEACHER: "Class Teacher",
  BURSAR: "Bursar",
  ACCOUNTANT: "Accountant",
  RECEPTIONIST: "Receptionist",
  LIBRARIAN: "Librarian",
  HOSTEL_MASTER: "Hostel Master",
  SUPPORT_STAFF: "Support Staff",
  PARENT: "Parent",
  STUDENT: "Student",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
