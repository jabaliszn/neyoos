import {
  competencyAccessMatrix,
  competencyActionSchema,
  competencyEvidenceApprovalSchema,
  competencyEvidenceSchema,
  competencyGroupSchema,
  competencySchema,
  userCanApproveCompetencyEvidence,
  userCanManageCompetencies,
  userCanReadCompetencies,
  userCanRecordCompetencyEvidence,
} from "../src/lib/validations/competency";
import { ROLES, type Role } from "../src/lib/core/roles";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function assertThrows(fn: () => unknown, message: string) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

const group = competencyGroupSchema.parse({
  curriculumId: "cur_1",
  name: "Core Competencies",
  code: "core",
  description: "Competencies used across learning areas.",
  sequence: 1,
  active: true,
});
assert(group.code === "CORE", "competency group code normalizes to uppercase");
assertThrows(() => competencyGroupSchema.parse({ name: "Core", code: "bad code!" }), "competency group rejects unsafe codes");
assertThrows(() => competencyGroupSchema.parse({ name: "Core", code: "CORE", hidden: "no" }), "competency group rejects unknown fields");

const competency = competencySchema.parse({
  groupId: "group_1",
  curriculumId: "cur_1",
  learningAreaId: "area_1",
  name: "Communication",
  code: "communication",
  description: "Learner explains ideas clearly and listens actively.",
  sequence: 1,
});
assert(competency.code === "COMMUNICATION", "competency code normalizes to uppercase");
assert(competency.learningAreaId === "area_1", "competency can link to learning area");

const evidence = competencyEvidenceSchema.parse({
  competencyId: "comp_1",
  studentId: "student_1",
  sourceModule: "ASSESSMENT",
  sourceId: "record_1",
  assessmentRecordId: "record_1",
  level: 4,
  scorePct: 88,
  narrative: "Clear oral communication during project presentation.",
  evidenceDate: "2026-07-01",
  approved: false,
  visibleToParents: false,
});
assert(evidence.sourceModule === "ASSESSMENT" && evidence.level === 4, "competency evidence accepts assessment source with level/score/narrative");
assertThrows(
  () => competencyEvidenceSchema.parse({ competencyId: "comp_1", studentId: "student_1", sourceModule: "MANUAL", evidenceDate: "2026-07-01" }),
  "competency evidence requires level, score or narrative"
);
assertThrows(
  () => competencyEvidenceSchema.parse({ competencyId: "comp_1", studentId: "student_1", sourceModule: "MANUAL", assessmentRecordId: "record_1", narrative: "Mismatch", evidenceDate: "2026-07-01" }),
  "competency evidence rejects assessmentRecordId with non-ASSESSMENT source"
);
assertThrows(
  () => competencyEvidenceSchema.parse({ competencyId: "comp_1", studentId: "student_1", sourceModule: "ASSESSMENT", cbcAssessmentId: "cbc_1", narrative: "Mismatch", evidenceDate: "2026-07-01" }),
  "competency evidence rejects cbcAssessmentId with non-CBC source"
);

const approval = competencyEvidenceApprovalSchema.parse({ evidenceId: "ev_1", approved: true, visibleToParents: true });
assert(approval.approved && approval.visibleToParents, "competency evidence approval schema accepts parent visibility");

const action = competencyActionSchema.parse({ action: "create_competency", payload: competency });
assert(action.action === "create_competency", "competency action schema validates create_competency");
const evidenceAction = competencyActionSchema.parse({ action: "record_evidence", payload: evidence });
assert(evidenceAction.action === "record_evidence", "competency action schema validates record_evidence");

const readRoles = new Set<Role>(["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES", "HOD", "TEACHER", "CLASS_TEACHER", "PARENT", "STUDENT", "BURSAR", "RECEPTIONIST", "LIBRARIAN", "HOSTEL_MASTER"]);
const manageRoles = new Set<Role>(["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES", "HOD"]);
const recordRoles = new Set<Role>(["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES", "HOD", "TEACHER", "CLASS_TEACHER"]);
const approveRoles = new Set<Role>(["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES"]);
const noDirectRoles = new Set<Role>(["ACCOUNTANT", "SUPPORT_STAFF"]);

const matrix = competencyAccessMatrix();
assert(matrix.length === ROLES.length, "competency access matrix covers all 16 roles");
for (const row of matrix) {
  if (readRoles.has(row.role)) assert(row.read, `${row.role} can read relevant competencies`);
  if (manageRoles.has(row.role)) assert(row.manage, `${row.role} can manage competencies`);
  if (recordRoles.has(row.role)) assert(row.recordEvidence, `${row.role} can record competency evidence`);
  if (approveRoles.has(row.role)) assert(row.approveEvidence, `${row.role} can approve competency evidence`);
  if (noDirectRoles.has(row.role)) assert(!row.read && !row.manage && !row.recordEvidence && !row.approveEvidence, `${row.role} has no direct competency framework access`);
}

assert(userCanManageCompetencies({ role: "TEACHER", secondaryRole: "HOD" }), "secondary HOD can manage competency framework");
assert(userCanReadCompetencies({ role: "ACCOUNTANT", secondaryRole: "TEACHER" }), "secondary Teacher can read competencies");
assert(userCanRecordCompetencyEvidence({ role: "PARENT", secondaryRole: "TEACHER" }), "secondary Teacher can record evidence");
assert(userCanApproveCompetencyEvidence({ role: "HOD", secondaryRole: "DEPUTY_PRINCIPAL" }), "secondary Deputy can approve evidence");
assert(!userCanApproveCompetencyEvidence({ role: "HOD", secondaryRole: null }), "HOD alone cannot approve evidence for parent visibility");

console.log("\nJ.4 Chunk 2 competency validation + access rules test passed.");
