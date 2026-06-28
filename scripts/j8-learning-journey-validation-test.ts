import {
  learnerJourneyQuerySchema,
  learnerJourneyEntrySchema,
  learnerJourneyAccessMatrix,
  userCanReadLearnerJourney,
  userCanReadStaffLearnerJourney,
  userCanReadParentSafeLearnerJourney,
  userCanAccessLearnerJourneyMode,
  LEARNER_JOURNEY_SOURCES,
} from "../src/lib/validations/learner-journey";

function main() {
  console.log("Starting J.8 Learning Journey Timeline validation & security test...");

  // 1. Query schema parses valid input and defaults cleanly.
  const parsedQuery = learnerJourneyQuerySchema.parse({
    studentId: "student_123",
    from: "2026-01-01",
    to: "2026-12-31",
    source: "PORTFOLIO",
    limit: 40,
  });
  if (parsedQuery.mode !== "staff") throw new Error("Default mode should be staff.");
  console.log("✓ valid timeline query parses with defaults correctly");

  // 2. Query schema rejects invalid date windows.
  const invalidWindow = learnerJourneyQuerySchema.safeParse({
    studentId: "student_123",
    from: "2026-12-31",
    to: "2026-01-01",
  });
  if (invalidWindow.success) throw new Error("Should reject end date before start date.");
  console.log("✓ invalid date window rejected correctly");

  // 3. Query schema rejects invalid source values.
  const invalidSource = learnerJourneyQuerySchema.safeParse({
    studentId: "student_123",
    source: "WHATSAPP",
  });
  if (invalidSource.success) throw new Error("Should reject unsupported timeline source.");
  console.log("✓ invalid source rejected correctly");

  // 4. Entry schema accepts a valid normalized timeline entry.
  const entry = learnerJourneyEntrySchema.parse({
    id: "entry_1",
    date: "2026-06-28",
    sourceModule: "EXAM",
    eventType: "RESULT_RELEASED",
    title: "CAT 1 — Term 2 results released",
    summary: "Achieng scored 85% and ranked position 2 in Form 2 East.",
    status: "PUBLISHED",
    href: "/exams/exam_1/report/student_1",
    visibility: "PARENT_SAFE",
    verificationStatus: "VERIFIED",
  });
  if (entry.sourceModule !== "EXAM") throw new Error("Timeline entry parsing failed.");
  console.log("✓ normalized timeline entry schema parses correctly");

  // 5. Access matrix spot checks across the 16 roles.
  const matrix = learnerJourneyAccessMatrix();
  const principal = matrix.find((m) => m.role === "PRINCIPAL");
  const teacher = matrix.find((m) => m.role === "TEACHER");
  const parent = matrix.find((m) => m.role === "PARENT");
  const student = matrix.find((m) => m.role === "STUDENT");
  const accountant = matrix.find((m) => m.role === "ACCOUNTANT");

  if (!principal?.readAny || !principal.readStaff || !principal.readParentSafe) throw new Error("Principal permissions incorrect");
  if (!teacher?.readAny || !teacher.readStaff || !teacher.readParentSafe) throw new Error("Teacher permissions incorrect");
  if (!parent?.readAny || parent.readStaff || !parent.readParentSafe) throw new Error("Parent permissions incorrect");
  if (!student?.readAny || student.readStaff || !student.readParentSafe) throw new Error("Student permissions incorrect");
  if (accountant?.readAny || accountant?.readStaff || accountant?.readParentSafe) throw new Error("Accountant should not gain learner journey access without student/academic visibility.");
  console.log("✓ 16-role access matrix spot-checks pass (staff vs parent-safe timeline access)");

  // 6. Secondary role inheritance.
  const dualRoleTeacher = { role: "PARENT" as const, secondaryRole: "HOD" as const };
  if (!userCanReadLearnerJourney(dualRoleTeacher)) throw new Error("Secondary role should inherit learner journey read access.");
  if (!userCanReadStaffLearnerJourney(dualRoleTeacher)) throw new Error("Secondary HOD role should allow staff journey mode.");
  console.log("✓ secondary role inheritance works correctly for learner journey access");

  // 7. Explicit mode guard helpers.
  const pureParent = { role: "PARENT" as const, secondaryRole: null };
  if (!userCanReadParentSafeLearnerJourney(pureParent)) throw new Error("Parent should read parent-safe timeline.");
  if (userCanAccessLearnerJourneyMode(pureParent, "staff")) throw new Error("Parent should not access staff-only timeline mode.");
  if (!userCanAccessLearnerJourneyMode(pureParent, "parent")) throw new Error("Parent should access parent-safe mode.");
  console.log("✓ mode guard helpers enforce staff vs parent-safe timeline access correctly");

  // 8. Source coverage sanity.
  if (!LEARNER_JOURNEY_SOURCES.includes("PORTFOLIO") || !LEARNER_JOURNEY_SOURCES.includes("DISCIPLINE")) {
    throw new Error("Core sources missing from learner journey source registry.");
  }
  console.log("✓ learner journey source registry includes core existing modules");

  console.log("J.8 Chunk 2 Learning Journey Timeline validation test passed.");
}

main();
