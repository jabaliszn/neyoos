import {
  classCurriculumMappingSchema,
  curriculumAccessMatrix,
  curriculumActionSchema,
  curriculumMappingsSchema,
  curriculumSchema,
  educationLevelSchema,
  gradeBandSchema,
  learningAreaSchema,
  userCanManageCurriculum,
  userCanReadCurriculum,
} from "../src/lib/validations/curriculum";
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

const validCurriculum = curriculumSchema.parse({
  name: "CBC Kenya",
  country: "Kenya",
  context: "Junior and senior school",
  activeVersion: "2026",
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-12-31",
  isActive: true,
  notes: "Configurable framework, not hardcoded.",
});
assert(validCurriculum.name === "CBC Kenya", "curriculum schema accepts a valid Kenyan curriculum");

assertThrows(
  () => curriculumSchema.parse({ name: "CBC", activeVersion: "2027", effectiveFrom: "2027-01-01", effectiveTo: "2026-12-31" }),
  "curriculum schema rejects an effective end date before the start date"
);

assertThrows(
  () => curriculumSchema.parse({ name: "CBC", activeVersion: "2027", secretToken: "do-not-store-here" }),
  "curriculum schema is strict and rejects unknown fields"
);

const level = educationLevelSchema.parse({
  curriculumId: "cur_1",
  name: "Senior School",
  levelKey: "senior",
  sequence: 4,
  description: "Pathway years",
});
assert(level.levelKey === "senior", "education level schema accepts configured level keys");

const grade = gradeBandSchema.parse({
  curriculumId: "cur_1",
  educationLevelId: "lvl_1",
  name: "Year 9",
  shortName: "Y9",
  sequence: 9,
  entryAge: 13,
  exitAge: 14,
});
assert(grade.name === "Year 9", "grade band schema accepts custom grade names, not only CBC/Form names");

assertThrows(
  () => gradeBandSchema.parse({ curriculumId: "cur_1", name: "Grade 6", sequence: 6, entryAge: 12, exitAge: 10 }),
  "grade band schema rejects exit age below entry age"
);

const area = learningAreaSchema.parse({
  curriculumId: "cur_1",
  name: "Creative Arts and Sports",
  code: "cas",
  description: "A flexible learning area.",
});
assert(area.code === "CAS", "learning area code is normalized to uppercase");

const mapping = classCurriculumMappingSchema.parse({ classId: "class_1", curriculumId: "", gradeBandId: null });
assert(mapping.curriculumId === undefined && mapping.gradeBandId === undefined, "mapping schemas normalize blank/null optional IDs");

const mappings = curriculumMappingsSchema.parse({
  subjects: [{ subjectId: "sub_1", curriculumId: "cur_1", learningAreaId: "area_1" }],
  classes: [{ classId: "cls_1", curriculumId: "cur_1", gradeBandId: "grade_1" }],
  terms: [{ termId: "term_1", curriculumId: "cur_1" }],
  strands: [{ strandId: "strand_1", learningAreaId: "area_1" }],
});
assert(mappings.subjects.length === 1 && mappings.classes.length === 1, "bulk mapping schema accepts existing Subject/Class/Term/Strand mappings");

const action = curriculumActionSchema.parse({ action: "create_learning_area", payload: { curriculumId: "cur_1", name: "Mathematics", code: "mat" } });
assert(action.action === "create_learning_area", "curriculum action schema validates discriminated API actions");

const manageRoles = new Set<Role>(["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "DEAN_OF_STUDIES", "HOD"]);
const readOnlyRoles = new Set<Role>(["TEACHER", "CLASS_TEACHER", "STUDENT"]);
const noAccessRoles = new Set<Role>(["BURSAR", "ACCOUNTANT", "RECEPTIONIST", "LIBRARIAN", "HOSTEL_MASTER", "SUPPORT_STAFF", "PARENT"]);

const matrix = curriculumAccessMatrix();
assert(matrix.length === ROLES.length, "curriculum access matrix covers all 16 roles");
for (const row of matrix) {
  if (manageRoles.has(row.role)) {
    assert(row.read && row.manage, `${row.role} can manage curriculum setup`);
  } else if (readOnlyRoles.has(row.role)) {
    assert(row.read && !row.manage, `${row.role} can read curriculum setup but cannot manage it`);
  } else if (noAccessRoles.has(row.role)) {
    assert(!row.read && !row.manage, `${row.role} cannot access curriculum setup`);
  } else {
    throw new Error(`Unclassified role in curriculum validation test: ${row.role}`);
  }
}

assert(userCanManageCurriculum({ role: "TEACHER", secondaryRole: "HOD" }), "secondaryRole is honoured for curriculum management");
assert(userCanReadCurriculum({ role: "BURSAR", secondaryRole: "TEACHER" }), "secondaryRole is honoured for curriculum read access");
assert(!userCanManageCurriculum({ role: "PARENT", secondaryRole: null }), "parents cannot manage curriculum setup");

console.log("\nJ.2 Chunk 2 validation + access rules test passed.");
