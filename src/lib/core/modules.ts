/**
 * NEYO module registry (Feature A.2.6 — per-tenant module toggling).
 * Each school enables/disables modules from here. `core: true` modules are
 * always on (cannot be disabled). `defaultOn` controls the starting state for
 * non-core modules when a school is created.
 *
 * Keys map to sidebar routes and (later) to feature gating.
 */
export interface ModuleDef {
  key: string;
  label: string;
  description: string;
  href: string;
  core: boolean; // locked on
  defaultOn: boolean;
}

export const MODULES: ModuleDef[] = [
  {
    key: "students",
    label: "Students",
    description: "Registration, profiles, classes and transfers.",
    href: "/students",
    core: true,
    defaultOn: true,
  },
  {
    key: "attendance",
    label: "Attendance",
    description: "Daily class registers and absentee follow-up.",
    href: "/attendance",
    core: false,
    defaultOn: true,
  },
  {
    key: "finance",
    label: "Finance",
    description: "Fee structures, invoices and M-Pesa payments.",
    href: "/finance",
    core: true,
    defaultOn: true,
  },
  {
    key: "academics",
    label: "Academics",
    description: "Subjects, streams, timetables and exams.",
    href: "/academics",
    core: false,
    defaultOn: true,
  },
  {
    key: "staff",
    label: "Staff",
    description: "Staff records, leave and payroll.",
    href: "/staff",
    core: false,
    defaultOn: true,
  },
  {
    key: "hostel",
    label: "Hostel",
    description: "Dorms, bed allocation and curfew attendance.",
    href: "/hostel",
    core: false,
    defaultOn: false, // off for day schools
  },
  {
    key: "transport",
    label: "Transport",
    description: "Routes, vehicles and student assignments.",
    href: "/transport",
    core: false,
    defaultOn: false,
  },
  {
    key: "library",
    label: "Library",
    description: "Book catalog, issue/return and fines.",
    href: "/library",
    core: false,
    defaultOn: false,
  },
  {
    key: "lms",
    label: "Learning (LMS)",
    description: "Notes, quizzes, assignments and online lessons.",
    href: "/lms",
    core: false,
    defaultOn: false,
  },
  {
    key: "inventory",
    label: "Inventory / Stores",
    description: "Stores, stock in/out, reorder alerts and uniform sales.",
    href: "/inventory",
    core: false,
    defaultOn: false,
  },
  {
    key: "cafeteria",
    label: "Cafeteria",
    description: "Weekly menu, kitchen board and meal cards billed to invoices.",
    href: "/cafeteria",
    core: false,
    defaultOn: false,
  },
  {
    // B.23 — THE BUNDI LAYER (founder 2026-06-13). Bundi the owl IS the
    // helper — we NEVER say "AI" anywhere in product copy. Shipped as
    // design-only and PAUSED platform-wide (G.22 PlatformFlag) until NEYO
    // launches it. NO other feature may depend on this module.
    key: "bundi",
    label: "Bundi",
    description: "Bundi, the NEYO owl, helps with comments, summaries and answers.",
    href: "/bundi",
    core: false,
    defaultOn: true, // visible the moment NEYO releases the platform pause
  },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);

export function getModuleDef(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key);
}

export function isModuleKey(key: string): boolean {
  return MODULE_KEYS.includes(key);
}
