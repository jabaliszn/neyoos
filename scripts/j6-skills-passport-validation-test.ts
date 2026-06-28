import {
  skillsPassportEntrySchema,
  skillsPassportEntryUpdateSchema,
  skillsPassportActionSchema,
  userCanReadSkillsPassport,
  userCanRecordSkillsPassport,
  skillsPassportAccessMatrix,
} from "../src/lib/validations/skills-passport";

function main() {
  console.log("Starting J.6 Skills Passport validation & security test...");

  // 1. Verify successful skill entry creation schema parsing
  const validEntry = {
    studentId: "student_123",
    skillArea: "Leadership",
    ratingLevel: 5,
    evidenceSource: "CLUB" as const,
    narrative: "Elected as Class Prefect and handles student welfare issues effectively.",
    evidenceDate: "2026-06-25",
    verified: true,
  };
  const parsedEntry = skillsPassportEntrySchema.parse(validEntry);
  console.log("✓ valid skills passport entry schema parses perfectly (5 stars, source CLUB)");

  // 2. Verify custom skill area parsing
  const customSkillEntry = {
    ...validEntry,
    skillArea: "Debate & Public Speaking", // custom safe string
  };
  const parsedCustom = skillsPassportEntrySchema.parse(customSkillEntry);
  console.log(`✓ custom skill area parses perfectly: ${parsedCustom.skillArea}`);

  // 3. Verify rating level limits (1..5)
  const outOfRangeEntry = { ...validEntry, ratingLevel: 6 };
  const res1 = skillsPassportEntrySchema.safeParse(outOfRangeEntry);
  if (res1.success) throw new Error("Should reject ratingLevel > 5.");
  console.log("✓ ratingLevel > 5 rejected correctly");

  // 4. Verify strict unknown field rejection
  const dirtyEntry = {
    ...validEntry,
    unknownMaliciousField: "DROP TABLE users;",
  };
  const res2 = skillsPassportEntrySchema.safeParse(dirtyEntry);
  if (res2.success) throw new Error("Should reject unknown fields strictly.");
  console.log("✓ unknown fields rejected strictly");

  // 5. Verify discriminated action schema parsing
  const actionInput = {
    action: "record_skill_rating",
    payload: validEntry,
  };
  const parsedAction = skillsPassportActionSchema.parse(actionInput);
  console.log(`✓ discriminated action schema parses action: ${parsedAction.action}`);

  // 6. Verify 16-role access matrix and secondary roles
  const matrix = skillsPassportAccessMatrix();
  const principal = matrix.find((m) => m.role === "PRINCIPAL");
  const teacher = matrix.find((m) => m.role === "TEACHER");
  const parent = matrix.find((m) => m.role === "PARENT");
  const student = matrix.find((m) => m.role === "STUDENT");
  const accountant = matrix.find((m) => m.role === "ACCOUNTANT");

  if (!principal?.record || !principal?.read) throw new Error("Principal permissions incorrect");
  if (!teacher?.record || !teacher?.read) throw new Error("Teacher permissions incorrect");
  if (!parent?.read || parent?.record) throw new Error("Parent permissions incorrect");
  if (!student?.read || student?.record) throw new Error("Student permissions incorrect");
  if (accountant?.record) throw new Error("Accountant permissions incorrect");
  console.log("✓ 16-role access matrix spot-checks pass perfectly (Principal/Teacher record/read, Parent/Student read-only, Accountant denied record)");

  // Verify secondary role inheritance
  const hodUser = { role: "SUPPORT_STAFF" as const, secondaryRole: "HOD" as const };
  if (!userCanRecordSkillsPassport(hodUser)) throw new Error("HOD secondary role should inherit record permissions");
  console.log("✓ secondary role inheritance works perfectly (SUPPORT_STAFF + HOD can record skill ratings)");

  console.log("J.6 Chunk 2 Skills Passport validation test passed.");
}

main();
