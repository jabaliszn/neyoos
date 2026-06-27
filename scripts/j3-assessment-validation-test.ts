import {
  assessmentAccessMatrix,
  assessmentActionSchema,
  assessmentEvidenceSchema,
  assessmentPlanSchema,
  assessmentPlanUpdateSchema,
  assessmentRecordSchema,
  assessmentTypeSchema,
  userCanAttachAssessmentEvidence,
  userCanManageAssessmentPlans,
  userCanReadAssessments,
  userCanReleaseAssessments,
  userCanScoreAssessments,
} from "../src/lib/validations/assessment";
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

const type = assessmentTypeSchema.parse({
  key: "project",
  name: "Project Work",
  category: "PRACTICAL",
  scoreMode: "MIXED",
  defaultMaxMarks: 100,
  defaultWeight: 20,
  evidenceAllowed: true,
  requiresModeration: true,
});
assert(type.key === "PROJECT", "assessment type key normalizes to uppercase");
assert(type.defaultWeight === 20, "assessment type accepts school-defined default weight");
assertThrows(
  () => assessmentTypeSchema.parse({ key: "bad key!", name: "Broken" }),
  "assessment type rejects unsafe keys"
);
assertThrows(
  () => assessmentTypeSchema.parse({ key: "PROJECT", name: "Project", hiddenField: "no" }),
  "assessment type schema rejects unknown fields"
);

const plan = assessmentPlanSchema.parse({
  assessmentTypeId: "type_1",
  curriculumId: "cur_1",
  learningAreaId: "area_1",
  classId: "class_1",
  academicTermId: "term_1",
  year: 2026,
  term: 2,
  title: "Term 2 Science Project",
  instructions: "Build a simple model and explain it to the class.",
  weight: 25,
  maxMarks: 100,
  dueDate: "2026-07-18",
  rubricJson: JSON.stringify([{ level: 4, code: "EE", label: "Excellent" }]),
  status: "ACTIVE",
});
assert(plan.title === "Term 2 Science Project" && plan.weight === 25, "assessment plan accepts curriculum/class/learning-area scope");
assertThrows(
  () => assessmentPlanSchema.parse({ assessmentTypeId: "type_1", year: 2026, term: 2, title: "No scope" }),
  "assessment plan requires at least one academic scope"
);
assertThrows(
  () => assessmentPlanSchema.parse({ assessmentTypeId: "type_1", subjectId: "subject_1", year: 2026, term: 2, title: "Too heavy", weight: 101 }),
  "assessment plan rejects weights above 100"
);
const partialPlan = assessmentPlanUpdateSchema.parse({ id: "plan_1", title: "Updated title" });
assert(partialPlan.id === "plan_1", "assessment plan update can update title without resending all scope fields");

const record = assessmentRecordSchema.parse({
  planId: "plan_1",
  studentId: "student_1",
  scoreMarks: 84,
  scorePct: 84,
  rubricLevel: 4,
  rubricCode: "EE",
  narrative: "Achieng explained the method clearly.",
  sourceModule: "MANUAL",
  sourceId: "plan_1",
});
assert(record.scorePct === 84 && record.rubricCode === "EE", "assessment record accepts marks, rubric and narrative together");
assertThrows(
  () => assessmentRecordSchema.parse({ planId: "plan_1", studentId: "student_1" }),
  "assessment record requires a score, rubric or narrative"
);
assertThrows(
  () => assessmentRecordSchema.parse({ planId: "plan_1", studentId: "student_1", scorePct: 120 }),
  "assessment record rejects score percentage above 100"
);

const evidence = assessmentEvidenceSchema.parse({
  recordId: "record_1",
  storedFileId: "file_1",
  fileUrl: "/api/files/encrypted/file_1",
  fileName: "science-project.jpg",
  contentType: "image/jpeg",
  evidenceType: "PHOTO",
  note: "Photo evidence from practical work.",
});
assert(evidence.evidenceType === "PHOTO", "assessment evidence accepts encrypted file references and evidence type");
assertThrows(
  () => assessmentEvidenceSchema.parse({ recordId: "record_1", evidenceType: "FILE" }),
  "assessment evidence requires a file reference, link or note"
);
assertThrows(
  () => assessmentEvidenceSchema.parse({ recordId: "record_1", fileUrl: "/api/files/presign", evidenceType: "FILE" }),
  "assessment evidence rejects legacy direct upload routes"
);

const seedAction = assessmentActionSchema.parse({ action: "seed_default_types", payload: {} });
assert(seedAction.action === "seed_default_types", "assessment action schema validates seed_default_types action");
const action = assessmentActionSchema.parse({ action: "create_plan", payload: plan });
assert(action.action === "create_plan", "assessment action schema validates create_plan action");
const release = assessmentActionSchema.parse({ action: "release_plan", payload: { planId: "plan_1", visibleToParents: true } });
assert(release.action === "release_plan", "assessment action schema validates release_plan action");

const readRoles = new Set<Role>(["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES", "HOD", "TEACHER", "CLASS_TEACHER", "PARENT", "STUDENT"]);
const manageRoles = new Set<Role>(["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES", "HOD"]);
const scoreRoles = new Set<Role>(["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES", "HOD", "TEACHER", "CLASS_TEACHER"]);
const releaseRoles = new Set<Role>(["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES"]);
const noAssessmentAccessRoles = new Set<Role>(["BURSAR", "ACCOUNTANT", "RECEPTIONIST", "LIBRARIAN", "HOSTEL_MASTER", "SUPPORT_STAFF"]);

const matrix = assessmentAccessMatrix();
assert(matrix.length === ROLES.length, "assessment access matrix covers all 16 roles");
for (const row of matrix) {
  if (readRoles.has(row.role)) assert(row.read, `${row.role} can read relevant assessments`);
  if (manageRoles.has(row.role)) assert(row.managePlans && row.moderate, `${row.role} can manage and moderate assessment plans`);
  if (scoreRoles.has(row.role)) assert(row.score && row.attachEvidence, `${row.role} can score and attach assessment evidence`);
  if (releaseRoles.has(row.role)) assert(row.release, `${row.role} can release assessments`);
  if (noAssessmentAccessRoles.has(row.role)) assert(!row.read && !row.managePlans && !row.score && !row.release, `${row.role} has no assessment engine access`);
}

assert(userCanManageAssessmentPlans({ role: "TEACHER", secondaryRole: "HOD" }), "secondary HOD can manage assessment plans");
assert(userCanReadAssessments({ role: "BURSAR", secondaryRole: "TEACHER" }), "secondary Teacher can read assessments");
assert(userCanScoreAssessments({ role: "PARENT", secondaryRole: "TEACHER" }), "secondary Teacher can score assessments");
assert(userCanAttachAssessmentEvidence({ role: "PARENT", secondaryRole: "TEACHER" }), "secondary Teacher can attach evidence");
assert(userCanReleaseAssessments({ role: "HOD", secondaryRole: "DEAN_OF_STUDIES" }), "secondary Dean can release assessments");
assert(!userCanReleaseAssessments({ role: "HOD", secondaryRole: null }), "HOD alone cannot release assessments");

console.log("\nJ.3 Chunk 2 assessment validation + access rules test passed.");
