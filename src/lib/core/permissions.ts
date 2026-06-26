/**
 * NEYO Permission Matrix (Feature A.3.2).
 * Fine-grained permission strings grouped by domain, mapped to roles.
 *
 * WHY strings (not just role checks): a feature declares the permission it needs
 * (e.g. "finance.record_payment") and we add it to whichever roles should have
 * it — instead of scattering role lists through the codebase. New roles or
 * re-orgs are a one-file change here.
 *
 * SUPER_ADMIN implicitly has every permission.
 */
import { ROLES, type Role } from "@/lib/core/roles";

// --- The full permission catalogue (extend as features land) ---
export const PERMISSIONS = [
  // Students (B.1)
  "student.view",
  "student.create",
  "student.edit",
  "student.delete",
  "class.manage",
  // Attendance (B.3)
  "attendance.view",
  "attendance.record",
  // Academics / Exams (B.4/B.5)
  "academics.view",
  "academics.manage",
  "exam.view",
  "exam.manage",
  "exam.enter_marks",
  "exam.publish",
  // Finance (B.7)
  "finance.view",
  "finance.create_invoice",
  "finance.record_payment",
  "finance.manage_structure",
  // Staff / HR (B.9)
  "staff.view",
  "staff.manage",
  // Communication (B.14)
  "comms.send",
  // Parent portal (B.10)
  "portal.parent",
  // Teacher portal (B.12)
  "portal.teacher",
  "homework.assign",
  // Reports / dashboards
  "reports.view",
  "owner.dashboard", // B.24: school-wide money + performance view (owner/principal)
  // Platform administration (A.2 etc.)
  "tenant.manage_modules",
  "tenant.export_data",
  "tenant.manage_settings",
  "user.manage_roles",
  "audit.view",
  // Developer / Public API (A.16)
  "api.manage",
  // Internal NEYO Operations (Part F) — SUPER_ADMIN only via implicit all-permissions.
  "platform.founder_ops",
  // Calendar (A.17)
  "calendar.view",
  "calendar.manage",
  // Reception / front desk (A.18)
  "reception.operate",
  // Library (B.15)
  "library.view",
  "library.manage",
  // Hostel (B.16)
  "hostel.view",
  "hostel.manage",
  // Transport (B.17)
  "transport.view",
  "transport.manage",
  // Inventory / Stores (B.18)
  "inventory.view",
  "inventory.manage",
  // Cafeteria (B.19)
  "cafeteria.view",
  "cafeteria.manage",
  // Discipline (B.20)
  "discipline.view",
  "discipline.manage",
  "counseling.confidential", // leadership-only: counseling notes
  // Medical / Clinic (B.21)
  "clinic.view",
  "clinic.manage",
  // Security (B.22)
  "security.view",
  "security.manage",
  "panic.raise", // every staff role may raise the alarm
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// Convenience bundles to keep the matrix readable.
const STUDENT_FULL: Permission[] = [
  "student.view",
  "student.create",
  "student.edit",
  "student.delete",
  "class.manage",
];
const FINANCE_FULL: Permission[] = [
  "finance.view",
  "finance.create_invoice",
  "finance.record_payment",
  "finance.manage_structure",
];
const ACADEMICS_FULL: Permission[] = [
  "academics.view",
  "academics.manage",
  "exam.view",
  "exam.manage",
  "exam.enter_marks",
  "exam.publish",
];
const LEADERSHIP: Permission[] = [
  ...STUDENT_FULL,
  ...FINANCE_FULL,
  ...ACADEMICS_FULL,
  "portal.teacher", // B.12/B.13 oversight: teacherClassIds() returns null (unrestricted) for leadership
  "homework.assign",
  "library.view",
  "library.manage",
  "hostel.view",
  "hostel.manage",
  "transport.view",
  "transport.manage",
  "inventory.view",
  "inventory.manage",
  "cafeteria.view",
  "cafeteria.manage",
  "discipline.view",
  "discipline.manage",
  "counseling.confidential",
  "clinic.view",
  "clinic.manage",
  "security.view",
  "security.manage",
  "panic.raise",
  "attendance.view",
  "attendance.record",
  "staff.view",
  "staff.manage",
  "comms.send",
  "reports.view",
  "owner.dashboard",
  "tenant.manage_modules",
  "tenant.export_data",
  "tenant.manage_settings",
  "user.manage_roles",
  "audit.view",
  "api.manage",
  "calendar.view",
  "calendar.manage",
  "reception.operate",
];

/** Role → permissions. SUPER_ADMIN handled separately (gets all). */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS], // everything
  SCHOOL_OWNER: LEADERSHIP,
  PRINCIPAL: LEADERSHIP,
  DEPUTY_PRINCIPAL: [
    "calendar.view",
    "calendar.manage",
    ...STUDENT_FULL,
    ...ACADEMICS_FULL,
    "attendance.view",
    "attendance.record",
    "finance.view",
    "staff.view",
    "comms.send",
    "reports.view",
    "audit.view",
    "tenant.manage_modules",
    "tenant.manage_settings",
    "discipline.view", // B.20 — discipline is the deputy's docket in KE schools
    "discipline.manage",
    "counseling.confidential",
    "clinic.view", // B.21 — deputy oversees student welfare incl. the sickbay
    "clinic.manage",
  ],
  DEAN_OF_STUDIES: [
    "calendar.view",
    "calendar.manage",
    "student.view",
    "student.edit",
    ...ACADEMICS_FULL,
    "attendance.view",
    "attendance.record",
    "comms.send",
    "reports.view",
    "portal.teacher", // B.12 — deans usually teach too
    "homework.assign",
  ],
  HOD: [
    "calendar.view",
    "calendar.manage",
    "student.view",
    "academics.view",
    "academics.manage",
    "exam.view",
    "exam.enter_marks",
    "attendance.view",
    "reports.view",
    "portal.teacher", // B.12 — HODs teach
    "homework.assign",
    "discipline.view",
    "discipline.manage", // I.7: HOD may propose discipline actions; Principal/Deputy approves.
    "security.view", // I.7: HOD may propose gate passes; gate confirmation remains security desk.
  ],
  TEACHER: [
    "calendar.view",
    "calendar.manage",
    "student.view", // row-scoped to own classes later (A.3.8)
    "attendance.view",
    "attendance.record",
    "academics.view",
    "exam.view",
    "exam.enter_marks",
    "comms.send",
    "portal.teacher", // B.12 "My Classes" teacher home
    "homework.assign",
    "discipline.view", // B.20: subject teachers report incidents too
    "discipline.manage",
    "panic.raise",
  ],
  CLASS_TEACHER: [
    "calendar.view",
    "calendar.manage",
    "student.view",
    "student.edit",
    "attendance.view",
    "attendance.record",
    "academics.view",
    "exam.view",
    "exam.enter_marks",
    "comms.send",
    "reports.view",
    "portal.teacher", // B.12
    "homework.assign",
    "discipline.view", // B.20: teachers REPORT incidents for their classes
    "discipline.manage",
    "panic.raise",
  ],
  BURSAR: [
    "calendar.view",
    "student.view",
    ...FINANCE_FULL,
    "comms.send",
    "reports.view",
    "inventory.view", // B.18: bursar oversees stores + uniform sales
    "inventory.manage",
    "cafeteria.view", // B.19: meal cards are money — bursar territory
    "cafeteria.manage",
  ],
  ACCOUNTANT: [
    "calendar.view",
    "finance.view",
    "finance.create_invoice",
    "finance.record_payment",
    "reports.view",
  ],
  RECEPTIONIST: [
    "calendar.view",
    "reception.operate",
    "student.view",
    "student.create",
    "finance.view",
    "finance.record_payment",
    "comms.send",
    "security.view", // B.22: the gate desk checks passes + pickup lists
    "security.manage",
    "panic.raise",
  ],
  LIBRARIAN: ["student.view", "calendar.view", "library.view", "library.manage", "panic.raise"],
  HOSTEL_MASTER: ["student.view", "attendance.view", "attendance.record", "calendar.view", "hostel.view", "hostel.manage", "panic.raise"],
  SUPPORT_STAFF: ["calendar.view", "cafeteria.view", "clinic.view", "clinic.manage", "panic.raise"], // kitchen crew + the school nurse (no NURSE role in the 16)
  PARENT: [
    "calendar.view",
    "student.view", // row-scoped to own child later (A.3.9)
    "attendance.view",
    "exam.view", // published results, own child only (B.5)
    "finance.view",
    "portal.parent", // B.10 My Children portal
  ],
  STUDENT: [
    "calendar.view",
    "attendance.view",
    "academics.view",
    "exam.view", // published results, own only (B.5)
    "portal.parent", // B.11: SHARED family portal (founder: parents+students use the SAME portal)
  ],
};

/** True if a role has a permission (SUPER_ADMIN always true). */
export function can(role: Role, permission: Permission): boolean {
  if (role === "SUPER_ADMIN") return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Sorted, de-duplicated permission list for a role. */
export function permissionsForRole(role: Role): Permission[] {
  if (role === "SUPER_ADMIN") return [...PERMISSIONS];
  return Array.from(new Set(ROLE_PERMISSIONS[role] ?? [])).sort() as Permission[];
}

/** Runtime sanity: every role appears in the matrix. */
export function assertMatrixComplete(): void {
  for (const r of ROLES) {
    if (!(r in ROLE_PERMISSIONS)) {
      throw new Error(`Permission matrix missing role: ${r}`);
    }
  }
}
