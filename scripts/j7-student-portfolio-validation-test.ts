import {
  portfolioItemSchema,
  portfolioItemUpdateSchema,
  portfolioApprovalSchema,
  portfolioActionSchema,
  userCanReadPortfolio,
  userCanSubmitPortfolio,
  userCanApprovePortfolio,
  portfolioAccessMatrix,
  MAX_PORTFOLIO_FILE_SIZE_BYTES,
  STORAGE_WARNING_THRESHOLD_BYTES,
} from "../src/lib/validations/portfolio";

function main() {
  console.log("Starting J.7 Student Portfolio System validation & security test...");

  // 1. Verify successful portfolio item submission schema parsing
  const validItem = {
    studentId: "student_123",
    title: "Advanced Solar Powered IoT Farm Sensor",
    category: "PROJECT" as const,
    description: "Designed and built an IoT farm humidity sensor powered by a 5W solar panel.",
    storedFileId: "file_encrypted_abc123",
    fileUrl: "https://storage.neyo.co.ke/tenants/farm_sensor.pdf",
    fileName: "farm_sensor_report.pdf",
    fileSizeBytes: 5 * 1024 * 1024, // 5 MB
    status: "SUBMITTED" as const,
    visibleToParents: false,
  };
  const parsedItem = portfolioItemSchema.parse(validItem);
  console.log("✓ valid portfolio item schema parses perfectly (5 MB file, category PROJECT)");

  // 2. Verify media size control limit (reject > 50 MB)
  const oversizeItem = {
    ...validItem,
    fileSizeBytes: 60 * 1024 * 1024, // 60 MB
  };
  const res1 = portfolioItemSchema.safeParse(oversizeItem);
  if (res1.success) throw new Error("Should reject file size > 50 MB.");
  console.log(`✓ file size > 50 MB rejected correctly (Max limit: ${MAX_PORTFOLIO_FILE_SIZE_BYTES / (1024 * 1024)} MB)`);

  // Verify storage warning threshold constant exists
  if (STORAGE_WARNING_THRESHOLD_BYTES !== 10 * 1024 * 1024) throw new Error("Storage warning threshold incorrect");
  console.log(`✓ storage usage warning threshold constant verified (${STORAGE_WARNING_THRESHOLD_BYTES / (1024 * 1024)} MB)`);

  // 3. Verify content refinement (reject empty item with no file, link, or description)
  const emptyItem = {
    studentId: "student_123",
    title: "Empty Project",
    category: "PROJECT" as const,
  };
  const res2 = portfolioItemSchema.safeParse(emptyItem);
  if (res2.success) throw new Error("Should reject portfolio item with no content, file, or link.");
  console.log("✓ empty portfolio item with no content correctly rejected");

  // 4. Verify strict unknown field rejection
  const dirtyItem = {
    ...validItem,
    unknownMaliciousField: "DROP TABLE users;",
  };
  const res3 = portfolioItemSchema.safeParse(dirtyItem);
  if (res3.success) throw new Error("Should reject unknown fields strictly.");
  console.log("✓ unknown fields rejected strictly");

  // 5. Verify discriminated action schema parsing
  const actionInput = {
    action: "submit_item",
    payload: validItem,
  };
  const parsedAction = portfolioActionSchema.parse(actionInput);
  console.log(`✓ discriminated action schema parses action: ${parsedAction.action}`);

  // 6. Verify 16-role access matrix and secondary roles
  const matrix = portfolioAccessMatrix();
  const principal = matrix.find((m) => m.role === "PRINCIPAL");
  const teacher = matrix.find((m) => m.role === "TEACHER");
  const student = matrix.find((m) => m.role === "STUDENT");
  const parent = matrix.find((m) => m.role === "PARENT");
  const accountant = matrix.find((m) => m.role === "ACCOUNTANT");

  if (!principal?.approve || !principal?.submit || !principal?.read) throw new Error("Principal permissions incorrect");
  if (!teacher?.submit || !teacher?.read || teacher?.approve) throw new Error("Teacher permissions incorrect");
  if (!student?.submit || !student?.read || student?.approve) throw new Error("Student permissions incorrect (Student should be able to submit)");
  if (!parent?.read || parent?.submit || parent?.approve) throw new Error("Parent permissions incorrect");
  if (accountant?.submit || accountant?.approve) throw new Error("Accountant permissions incorrect");
  console.log("✓ 16-role access matrix spot-checks pass perfectly (Principal approve/submit/read, Teacher submit/read, Student submit/read, Parent read-only, Accountant denied submit/approve)");

  // Verify secondary role inheritance
  const hodUser = { role: "TEACHER" as const, secondaryRole: "HOD" as const };
  if (!userCanApprovePortfolio(hodUser)) throw new Error("HOD secondary role should inherit approve permissions");
  console.log("✓ secondary role inheritance works perfectly (TEACHER + HOD can approve portfolio items)");

  console.log("J.7 Chunk 2 Student Portfolio System validation test passed.");
}

main();
