import {
  rubricSchema,
  rubricUpdateSchema,
  attachRubricSchema,
  scoreWithRubricSchema,
  attachRubricEvidenceSchema,
  rubricActionSchema,
  userCanReadRubrics,
  userCanManageRubrics,
  userCanScoreWithRubrics,
  rubricAccessMatrix,
} from "../src/lib/validations/rubric";

function main() {
  console.log("Starting J.5 Rubrics & Evidence validation & security test...");

  // 1. Verify successful rubric creation schema parsing
  const validRubric = {
    name: "5-Level Cambridge Project Rubric",
    description: "Evaluates project work across 5 levels of mastery.",
    category: "PROJECT",
    isArchived: false,
    levels: [
      { level: 5, code: "EXCELLENT", label: "Excellent mastery", descriptor: "Outstanding work.", points: 100 },
      { level: 4, code: "GOOD", label: "Good mastery", descriptor: "Solid work.", points: 80 },
      { level: 3, code: "SATISFACTORY", label: "Satisfactory", descriptor: "Meets basic expectations.", points: 60 },
      { level: 2, code: "PASS", label: "Pass", descriptor: "Barely meets passing criteria.", points: 40 },
      { level: 1, code: "NEEDS_WORK", label: "Needs Work", descriptor: "Does not meet passing criteria.", points: 20 },
    ],
  };
  const parsedRubric = rubricSchema.parse(validRubric);
  console.log("✓ valid rubric schema parses perfectly with 5 levels");

  // 2. Verify unique level numbers and codes refinement
  const duplicateLevelRubric = {
    name: "Duplicate Level Rubric",
    category: "GENERAL",
    levels: [
      { level: 1, code: "BASIC", label: "Basic" },
      { level: 1, code: "ADVANCED", label: "Advanced" }, // duplicate level number
    ],
  };
  const res1 = rubricSchema.safeParse(duplicateLevelRubric);
  if (res1.success) throw new Error("Should reject duplicate rubric level numbers.");
  console.log("✓ duplicate rubric level numbers rejected correctly");

  const duplicateCodeRubric = {
    name: "Duplicate Code Rubric",
    category: "GENERAL",
    levels: [
      { level: 2, code: "PASS", label: "Pass 2" },
      { level: 1, code: "PASS", label: "Pass 1" }, // duplicate code
    ],
  };
  const res2 = rubricSchema.safeParse(duplicateCodeRubric);
  if (res2.success) throw new Error("Should reject duplicate rubric level codes.");
  console.log("✓ duplicate rubric level codes rejected correctly");

  // 3. Verify strict unknown field rejection
  const dirtyRubric = {
    ...validRubric,
    unknownMaliciousField: "DROP TABLE users;",
  };
  const res3 = rubricSchema.safeParse(dirtyRubric);
  if (res3.success) throw new Error("Should reject unknown fields strictly.");
  console.log("✓ unknown fields rejected strictly");

  // 4. Verify discriminated action schema parsing
  const actionInput = {
    action: "create_rubric",
    payload: validRubric,
  };
  const parsedAction = rubricActionSchema.parse(actionInput);
  console.log(`✓ discriminated action schema parses action: ${parsedAction.action}`);

  // 5. Verify 16-role access matrix and secondary roles
  const matrix = rubricAccessMatrix();
  const principal = matrix.find((m) => m.role === "PRINCIPAL");
  const teacher = matrix.find((m) => m.role === "TEACHER");
  const parent = matrix.find((m) => m.role === "PARENT");
  const bursar = matrix.find((m) => m.role === "BURSAR");

  if (!principal?.manage || !principal?.score || !principal?.read) throw new Error("Principal permissions incorrect");
  if (!teacher?.read || !teacher?.score || teacher?.manage) throw new Error("Teacher permissions incorrect");
  if (!parent?.read || parent?.manage || parent?.score) throw new Error("Parent permissions incorrect");
  if (bursar?.manage || bursar?.score) throw new Error("Bursar permissions incorrect");
  console.log("✓ 16-role access matrix spot-checks pass perfectly (Principal manage/score/read, Teacher score/read, Parent read-only, Bursar denied)");

  // Verify secondary role inheritance
  const hodUser = { role: "TEACHER" as const, secondaryRole: "HOD" as const };
  if (!userCanManageRubrics(hodUser)) throw new Error("HOD secondary role should inherit manage permissions");
  console.log("✓ secondary role inheritance works perfectly (TEACHER + HOD can manage rubrics)");

  console.log("J.5 Chunk 2 Rubrics & Evidence validation test passed.");
}

main();
