/**
 * Part-J feature registry.
 *
 * Founder requirement (2026-06-29): "THE WHOLE J FEATURES CAN BE SWITCHED OFF
 * OR ON IN THE NEYO OPS BEFORE LAUNCH BUT FOR NOW IT SHOULD BE ON."
 *
 * Each Part-J feature has a stable key. NEYO Ops (SUPER_ADMIN) can pause/release
 * any of them platform-wide using the existing PlatformFlag table, with keys
 * prefixed `jfeature:`. They default to ON (not paused) — a feature is only OFF
 * if an explicit PlatformFlag row marks it paused.
 */

export const J_FEATURE_PREFIX = "jfeature:";

export interface JFeatureDef {
  /** stable id used in the flag key, e.g. "J.21" */
  id: string;
  label: string;
  description: string;
}

export const J_FEATURES: JFeatureDef[] = [
  { id: "J.3", label: "Flexible Assessment Engine", description: "Configurable assessment types, plans, scoring, moderation & release." },
  { id: "J.7", label: "Student Portfolio System", description: "Learner portfolio evidence, approval workflow and export pack." },
  { id: "J.14", label: "Transfer Passport", description: "Portable learner transfer record between schools." },
  { id: "J.15", label: "Modular Report Builder", description: "School-configurable report card templates." },
  { id: "J.16", label: "Advanced Analytics", description: "Cohort, competency and performance analytics." },
  { id: "J.17", label: "Community Service", description: "Service hours, evidence and certificates." },
  { id: "J.18", label: "Career Discovery", description: "Rule-based career & pathway guidance." },
  { id: "J.19", label: "Whole-School Ecosystem", description: "Integrated learner journey + anonymous ecosystem trends." },
  { id: "J.20", label: "Curriculum Versioning", description: "Future-proof curriculum versions & effective-dated templates." },
  { id: "J.21", label: "NEYO Ops Curriculum Template Library", description: "Company-level curriculum templates schools can adopt." },
  { id: "J.22", label: "Compliance, Consent & Data Safety", description: "Transfer passport consent, ODPC data-minimisation, retention and export audit." },
  // J.23 revenue features — each premium feature also has a master ON/OFF switch.
  { id: "J.23.1", label: "Revenue: Skills Passport", description: "Premium Skills Passport & Portfolio (paid add-on / Elite)." },
  { id: "J.23.2", label: "Revenue: Portfolio Storage", description: "Portfolio storage add-on linked to Storage Vault quota." },
  { id: "J.23.3", label: "Revenue: Career & Pathways", description: "Career discovery & pathway guidance (Pro/Elite)." },
  { id: "J.23.4", label: "Revenue: Advanced Analytics", description: "Advanced school analytics (Pro/Elite)." },
  { id: "J.23.5", label: "Revenue: Report Builder", description: "Custom modular report-template design (paid/Elite)." },
  { id: "J.23.6", label: "Revenue: Transfer Passport", description: "Inter-school transfer passport (premium trust feature)." },
];

export const J_FEATURE_IDS = J_FEATURES.map((f) => f.id);

export function jFeatureKey(id: string): string {
  return `${J_FEATURE_PREFIX}${id}`;
}

export function isJFeatureKey(key: string): boolean {
  return key.startsWith(J_FEATURE_PREFIX) && J_FEATURE_IDS.includes(key.slice(J_FEATURE_PREFIX.length));
}

export function getJFeatureDef(id: string): JFeatureDef | undefined {
  return J_FEATURES.find((f) => f.id === id);
}
