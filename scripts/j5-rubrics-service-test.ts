import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import type { SessionUser } from "../src/lib/core/session";
import {
  ensureDefaultRubrics,
  rubricBoard,
  createRubric,
  updateRubric,
  archiveRubric,
  attachRubric,
  scoreWithRubric,
  attachEvidenceFile,
  RubricError,
} from "../src/lib/services/rubric.service";

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof db.user.findFirst>>>): SessionUser {
  return { id: user.id, tenantId: user.tenantId, neyoLoginId: user.neyoLoginId, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role as SessionUser["role"], secondaryRole: (user.secondaryRole as SessionUser["secondaryRole"]) ?? null, language: user.language ?? "en" };
}

async function main() {
  console.log("Starting J.5 Rubrics & Evidence service test...");
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principalRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const teacherRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "p.njoroge@karibuhigh.ac.ke" } });
  const accountantRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "accounts@karibuhigh.ac.ke" } });

  const principal = toSessionUser(principalRow);
  const teacher = toSessionUser(teacherRow);
  const accountant = toSessionUser(accountantRow);

  await withTenant(tenant.id, async () => {
    // 0. Clean up any leftover test rubrics and assessment types from previous runs
    await tenantDb().rubric.deleteMany({
      where: { name: { in: ["Formative Science Lab Rubric", "Formative Science Lab Rubric (Updated)", "Unauthorized Rubric"] } },
    });
    await tenantDb().assessmentType.deleteMany({
      where: { key: "LAB_TEST" },
    });

    // 1. Ensure default rubrics are seeded
    const seedRes = await ensureDefaultRubrics(principal);
    console.log(`✓ seeded default rubrics (${seedRes.seededCount} new)`);

    // 2. Verify board access for roles
    const boardPrincipal = await rubricBoard(principal);
    if (!boardPrincipal.canManage || !boardPrincipal.canScore) throw new Error("Principal board flags incorrect");
    const boardTeacher = await rubricBoard(teacher);
    if (boardTeacher.canManage || !boardTeacher.canScore) throw new Error("Teacher board flags incorrect");
    console.log("✓ rubric board returns correct role permission flags (Teacher can score but cannot manage)");

    await rubricBoard(accountant).then(() => { throw new Error("Accountant should be forbidden from rubric board"); }).catch((e) => {
      if (e instanceof RubricError && e.code === "FORBIDDEN") console.log("✓ Accountant correctly forbidden from rubric board");
      else throw e;
    });

    // 3. Create a custom rubric as principal
    const customRubric = await createRubric(principal, {
      name: "Formative Science Lab Rubric",
      description: "Scores practical science lab work and safety adherence.",
      category: "PRACTICAL",
      isArchived: false,
      levels: [
        { level: 3, code: "EXPERT", label: "Expert execution", descriptor: "Zero safety errors, flawless procedure.", points: 30 },
        { level: 2, code: "COMPETENT", label: "Competent execution", descriptor: "Minor procedural errors, safe execution.", points: 20 },
        { level: 1, code: "NOVICE", label: "Novice execution", descriptor: "Safety warnings or major procedural errors.", points: 10 },
      ],
    });
    console.log("✓ created custom rubric with 3 levels");

    // Verify teacher cannot create rubrics
    await createRubric(teacher, { name: "Unauthorized Rubric", category: "GENERAL", levels: [{ level: 1, code: "PASS", label: "Pass" }] })
      .then(() => { throw new Error("Teacher should not be able to create rubrics"); })
      .catch((e) => {
        if (e instanceof RubricError && e.code === "FORBIDDEN") console.log("✓ Teacher correctly forbidden from managing rubric definitions");
        else throw e;
      });

    // Verify duplicate name denial
    await createRubric(principal, { name: "Formative Science Lab Rubric", category: "GENERAL", levels: [{ level: 1, code: "PASS", label: "Pass" }] })
      .then(() => { throw new Error("Should reject duplicate rubric name"); })
      .catch((e) => {
        if (e instanceof RubricError && e.code === "DUPLICATE") console.log("✓ duplicate rubric name correctly rejected");
        else throw e;
      });

    // 4. Update rubric levels
    const updatedRubric = await updateRubric(principal, {
      id: customRubric.id,
      name: "Formative Science Lab Rubric (Updated)",
      levels: [
        { level: 4, code: "MASTER", label: "Master execution", descriptor: "Exceptional lab work.", points: 40 },
        { level: 3, code: "EXPERT", label: "Expert execution", descriptor: "Zero safety errors.", points: 30 },
        { level: 2, code: "COMPETENT", label: "Competent execution", descriptor: "Safe execution.", points: 20 },
        { level: 1, code: "NOVICE", label: "Novice execution", descriptor: "Safety warnings.", points: 10 },
      ],
    });
    console.log("✓ updated rubric levels cleanly (replaced 3 levels with 4 levels)");

    // 5. Attach rubric to assessment plan and competency
    const assessmentType = await tenantDb().assessmentType.create({
      data: { key: "LAB_TEST", name: "Lab Practical", category: "PRACTICAL", scoreMode: "RUBRIC" } as never,
    });
    const plan = await tenantDb().assessmentPlan.create({
      data: { assessmentTypeId: assessmentType.id, title: "Biology Dissection Lab", year: 2026, term: 2, createdById: principal.id, createdByName: principal.fullName } as never,
    });
    const student = await tenantDb().student.findFirstOrThrow({ where: { status: "ACTIVE" } });
    const record = await tenantDb().assessmentRecord.create({
      data: { planId: plan.id, studentId: student.id, assessedById: teacher.id, assessedByName: teacher.fullName } as never,
    });

    const attachPlanRes = await attachRubric(principal, { rubricId: updatedRubric.id, targetType: "assessment_plan", targetId: plan.id });
    console.log("✓ attached rubric to AssessmentPlan via service");

    // 6. Score assessment record with rubric as teacher
    const scoredRecord = await scoreWithRubric(teacher, {
      targetType: "assessment_record",
      targetId: record.id,
      rubricId: updatedRubric.id,
      rubricLevel: 3,
      rubricCode: "EXPERT",
      narrative: "Excellent technique during dissection, handled scalpel safely.",
    });
    if (!("status" in scoredRecord) || scoredRecord.rubricLevel !== 3 || scoredRecord.scoreMarks !== 30 || scoredRecord.status !== "SCORED") {
      throw new Error("Scoring did not apply level, calculated points or status correctly.");
    }
    console.log("✓ teacher scored assessment record with rubric successfully (Level 3 EXPERT -> 30 marks auto-calculated)");

    // Verify invalid rubric level rejection
    await scoreWithRubric(teacher, { targetType: "assessment_record", targetId: record.id, rubricId: updatedRubric.id, rubricLevel: 5, rubricCode: "UNKNOWN", narrative: "Test" })
      .then(() => { throw new Error("Should reject unknown rubric level"); })
      .catch((e) => {
        if (e instanceof RubricError && e.code === "INVALID") console.log("✓ invalid rubric level correctly rejected");
        else throw e;
      });

    // 7. Attach encrypted evidence file as teacher
    // Create dummy StoredFile representing encrypted Storage Vault upload
    const storedFile = await tenantDb().storedFile.create({
      data: { key: `tenants/${tenant.id}/evidence/fake123.pdf`, url: `https://storage.neyo.co.ke/tenants/${tenant.id}/evidence/fake123.pdf`, fileName: "fake123.pdf", contentType: "application/pdf", size: 1024, uploadedById: teacher.id, encrypted: true } as never,
    });

    const evidence = await attachEvidenceFile(teacher, {
      targetType: "assessment_record",
      targetId: record.id,
      storedFileId: storedFile.id,
      fileUrl: `https://storage.neyo.co.ke/tenants/${tenant.id}/evidence/fake123.pdf`,
      fileName: "lab_notes.pdf",
      contentType: "application/pdf",
      evidenceType: "FILE",
      note: "Scanned student lab workbook showing labeled diagrams.",
    });
    console.log("✓ attached encrypted evidence file to assessment record successfully");

    // Verify missing StoredFile reference rejection
    await attachEvidenceFile(teacher, { targetType: "assessment_record", targetId: record.id, storedFileId: "nonexistent_id", fileUrl: "https://example.com/fake.pdf", fileName: "fake.pdf" })
      .then(() => { throw new Error("Should reject missing StoredFile reference"); })
      .catch((e) => {
        if (e instanceof RubricError && e.code === "NOT_FOUND") console.log("✓ missing StoredFile reference correctly rejected (enforces encrypted Storage Vault path)");
        else throw e;
      });

    // 8. Archive rubric
    await archiveRubric(principal, updatedRubric.id, true);
    console.log("✓ archived rubric successfully");

    // 9. Verify audit logs
    const recentAudits = await tenantDb().auditLog.findMany({
      where: { action: { in: ["rubric.created", "rubric.updated", "rubric.attached", "rubric.scored", "rubric.evidence_attached", "rubric.archived"] } },
    });
    if (recentAudits.length < 5) throw new Error("Audit logs not generated correctly.");
    console.log(`✓ audit logs verified (${recentAudits.length} events recorded across rubric lifecycle)`);

    // 10. Clean up test data
    await tenantDb().assessmentEvidence.delete({ where: { id: evidence.id } });
    await tenantDb().storedFile.delete({ where: { id: storedFile.id } });
    await tenantDb().assessmentRecord.delete({ where: { id: record.id } });
    await tenantDb().assessmentPlan.delete({ where: { id: plan.id } });
    await tenantDb().assessmentType.delete({ where: { id: assessmentType.id } });
    await tenantDb().rubric.delete({ where: { id: customRubric.id } });
    console.log("✓ cleaned up test data cleanly");
  });

  console.log("J.5 Chunk 3 Rubrics & Evidence service test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
