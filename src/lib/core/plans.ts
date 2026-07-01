/**
 * NEYO subscription plans (Feature A.5 + G.23 founder upgrade 2026-06-12:
 * "THE BILLING SYSTEM SHOULD BE AS DETAILED SO THAT NEYO THE COMPANY CAN
 * HAVE DIFFERENT PACKAGES").
 *
 * Each plan now carries:
 * - hard usage limits (students/staff) with soft-overage allowances
 * - includedModules: which module keys the package unlocks
 * - perStudentPerTerm: optional per-learner pricing (KES) on top of the base
 * - addOns the school can buy à la carte (priced per term), including SMS top-ups
 * Prices in KES per term. Price GRANDFATHERING stays (locked at signup).
 */
export interface PlanLimits {
  students: number; // max enrolled students
  staff: number;
  /** SMS is intentionally outside packages. Keep this 0; schools buy SMS top-ups separately. */
  smsPerTerm: number;
}

export interface AddOnDef {
  key: string;
  name: string;
  pricePerTerm: number; // KES
  description: string;
}

export interface PlanDef {
  key: string;
  name: string;
  tagline: string;
  pricePerTerm: number; // KES base
  perStudentPerTerm: number; // KES per enrolled learner (0 = flat)
  limits: PlanLimits;
  includedModules: string[]; // module keys unlocked by this package
  maxAddOns: number;
  overageAllowance: number; // e.g. 1.1 = 10% over the soft limit before hard stop
  support: string;
  highlights: string[];
}

/** À-la-carte add-ons any paid plan can buy (up to its maxAddOns). */
export const ADD_ONS: AddOnDef[] = [
  { key: "sms_topup_1000", name: "SMS top-up (1,000)", pricePerTerm: 800, description: "Out-of-package bundle: 1,000 SMS for school messages this term." },
  { key: "extra_storage", name: "Extra storage (10GB)", pricePerTerm: 500, description: "More room for notes, photos and documents." },
  { key: "hostel_module", name: "Hostel module", pricePerTerm: 2500, description: "Dorms, beds, curfew register, boarding fees." },
  { key: "transport_module", name: "Transport module", pricePerTerm: 2500, description: "Routes, fleet compliance, transport fees." },
  { key: "inventory_module", name: "Inventory & cafeteria", pricePerTerm: 2000, description: "Stores, stock, meal cards, uniform catalogue." },
  { key: "priority_support", name: "Priority support", pricePerTerm: 3000, description: "Same-day responses, onboarding help." },
  
  // PART J.23 Premium Add-ons
  { key: "skills_passport", name: "Skills Passport & Portfolio", pricePerTerm: 3500, description: "Premium tracking of learner talents and digital evidence." },
  { key: "custom_reports", name: "Modular Report Builder", pricePerTerm: 1500, description: "Design infinite custom no-code report card layouts." },
  { key: "advanced_analytics", name: "Advanced School Analytics", pricePerTerm: 5000, description: "Systemic insights, attendance-performance correlations, and intervention alerts." },
  { key: "pathway_guidance", name: "Career Discovery & Pathways", pricePerTerm: 2000, description: "Track student interests and map Senior School pathways." },
  { key: "transfer_passport", name: "Inter-School Transfer Passport", pricePerTerm: 1800, description: "Premium portable learner transfer record between schools (trust feature)." },
];

const CORE = ["students", "attendance", "finance", "academics", "staff"];

export const PLANS: PlanDef[] = [
  {
    key: "free_karibu",
    name: "Free Karibu",
    tagline: "For small schools getting started",
    pricePerTerm: 0,
    perStudentPerTerm: 0,
    limits: { students: 50, staff: 10, smsPerTerm: 0 },
    includedModules: [...CORE],
    maxAddOns: 0,
    overageAllowance: 1.0, // no overage on free
    support: "Community support",
    highlights: [
      "Up to 50 students",
      "Core modules: students, attendance, finance, academics, staff",
      "M-Pesa fee collection included",
    ],
  },
  {
    key: "msingi",
    name: "Msingi",
    tagline: "Day schools that want the full academic suite",
    pricePerTerm: 4500,
    perStudentPerTerm: 0,
    limits: { students: 250, staff: 35, smsPerTerm: 0 },
    includedModules: [...CORE, "library", "lms"],
    maxAddOns: 2,
    overageAllowance: 1.1,
    support: "Email support (48h)",
    highlights: [
      "Up to 250 students",
      "Library + Learning (LMS) included",
      "Up to 2 add-ons",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "Growing schools, day or boarding",
    pricePerTerm: 9000,
    perStudentPerTerm: 0,
    limits: { students: 600, staff: 80, smsPerTerm: 0 },
    includedModules: [...CORE, "library", "lms", "hostel", "transport"],
    maxAddOns: 3,
    overageAllowance: 1.1,
    support: "Email + WhatsApp support (24h)",
    highlights: [
      "Up to 600 students",
      "Hostel + Transport included",
      "Up to 3 add-ons",
    ],
  },
  {
    key: "elite",
    name: "Elite",
    tagline: "Large schools and group academies",
    pricePerTerm: 22000,
    perStudentPerTerm: 0,
    limits: { students: 5000, staff: 500, smsPerTerm: 0 },
    // Elite implicitly unlocks premium Part J features
    // Elite bundles every premium Part-J revenue feature (J.23).
    includedModules: [...CORE, "library", "lms", "hostel", "transport", "inventory", "cafeteria", "extra_storage", "skills_passport", "custom_reports", "advanced_analytics", "pathway_guidance", "transfer_passport"],
    maxAddOns: 15,
    overageAllowance: 1.25,
    support: "Priority support + onboarding",
    highlights: [
      "Up to 5,000 students",
      "Every module included",
      "Custom domain",
      "Priority support & up to 10 add-ons",
    ],
  },
];

export function getPlan(key: string): PlanDef | undefined {
  return PLANS.find((p) => p.key === key);
}

export function getAddOn(key: string): AddOnDef | undefined {
  return ADD_ONS.find((a) => a.key === key);
}

/** Term cost estimate for a plan at a given enrolment (per-student pricing seam). */
export function estimateTermCost(plan: PlanDef, students: number, addOnKeys: string[] = []): number {
  const addOns = addOnKeys
    .map((k) => getAddOn(k)?.pricePerTerm ?? 0)
    .reduce((a, b) => a + b, 0);
  return plan.pricePerTerm + plan.perStudentPerTerm * students + addOns;
}

export const DEFAULT_PLAN_KEY = "free_karibu";
