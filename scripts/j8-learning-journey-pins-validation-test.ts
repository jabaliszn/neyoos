import {
  learnerJourneyPinSchema,
  learnerJourneyUnpinSchema,
  learnerJourneyAccessMatrix,
  userCanPinLearnerJourney,
} from "../src/lib/validations/learner-journey";

function main() {
  console.log("Starting J.8 pinned milestones validation test...");

  const parsedPin = learnerJourneyPinSchema.parse({
    studentId: "student_123",
    entryId: "assessment:record_123",
    sourceModule: "ASSESSMENT",
    sourceRecordId: "record_123",
    note: "Important project milestone",
    visibility: "STAFF",
  });
  if (parsedPin.entryId !== "assessment:record_123") throw new Error("Pin schema should keep entry id.");
  console.log("✓ pin schema parses valid milestone payload correctly");

  const invalidPin = learnerJourneyPinSchema.safeParse({
    studentId: "student_123",
    entryId: "",
    sourceModule: "ASSESSMENT",
  });
  if (invalidPin.success) throw new Error("Pin schema should reject empty entry id.");
  console.log("✓ pin schema rejects invalid milestone payload");

  const parsedUnpin = learnerJourneyUnpinSchema.parse({
    studentId: "student_123",
    entryId: "assessment:record_123",
  });
  if (parsedUnpin.studentId !== "student_123") throw new Error("Unpin schema should parse valid payload.");
  console.log("✓ unpin schema parses valid payload correctly");

  const matrix = learnerJourneyAccessMatrix();
  const principal = matrix.find((row) => row.role === "PRINCIPAL");
  const teacher = matrix.find((row) => row.role === "TEACHER");
  const hod = matrix.find((row) => row.role === "HOD");
  const parent = matrix.find((row) => row.role === "PARENT");
  const accountant = matrix.find((row) => row.role === "ACCOUNTANT");

  if (!principal?.pinMilestones) throw new Error("Principal should be allowed to pin milestones.");
  if (!teacher?.pinMilestones) throw new Error("Teacher should be allowed to pin milestones.");
  if (!hod?.pinMilestones) throw new Error("HOD should be allowed to pin milestones.");
  if (parent?.pinMilestones) throw new Error("Parent should not be allowed to pin milestones.");
  if (accountant?.pinMilestones) throw new Error("Accountant should not be allowed to pin milestones.");
  console.log("✓ access matrix correctly distinguishes who may pin milestones");

  const dualRole = { role: "PARENT" as const, secondaryRole: "TEACHER" as const };
  if (!userCanPinLearnerJourney(dualRole)) throw new Error("Secondary teacher role should allow pinning.");
  console.log("✓ secondary staff roles inherit pin permissions correctly");

  console.log("J.8 pinned milestones validation test passed.");
}

main();
