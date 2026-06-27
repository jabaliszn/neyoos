import { db } from "../src/lib/db";
import { TENANT_OWNED_MODELS } from "../src/lib/core/tenant-tables";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function cleanup(tenantId: string) {
  await db.assessmentEvidence.deleteMany({ where: { tenantId } });
  await db.assessmentRecord.deleteMany({ where: { tenantId } });
  await db.assessmentPlan.deleteMany({ where: { tenantId, title: { startsWith: "J3 Schema" } } });
  await db.assessmentType.deleteMany({ where: { tenantId, key: { startsWith: "J3_" } } });
}

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, status: "ACTIVE", deletedAt: null } });
  const curriculum = await db.curriculum.findFirst({ where: { tenantId: tenant.id } });
  const learningArea = await db.learningArea.findFirst({ where: { tenantId: tenant.id } });
  const subject = await db.subject.findFirst({ where: { tenantId: tenant.id } });
  const schoolClass = await db.schoolClass.findFirst({ where: { tenantId: tenant.id } });
  const term = await db.academicTerm.findFirst({ where: { tenantId: tenant.id, current: true } });

  await cleanup(tenant.id);

  for (const model of ["assessmentType", "assessmentPlan", "assessmentRecord", "assessmentEvidence"]) {
    assert((TENANT_OWNED_MODELS as readonly string[]).includes(model), `${model} is tenant-owned`);
  }

  const type = await db.assessmentType.create({
    data: {
      tenantId: tenant.id,
      key: "J3_PROJECT",
      name: "J3 Project Work",
      description: "Schema test project assessment type",
      category: "PRACTICAL",
      scoreMode: "MIXED",
      defaultMaxMarks: 100,
      defaultWeight: 20,
      evidenceAllowed: true,
      requiresModeration: true,
      isSystem: false,
      active: true,
    },
  });
  assert(type.id && type.key === "J3_PROJECT", "AssessmentType creates with real DB");

  const plan = await db.assessmentPlan.create({
    data: {
      tenantId: tenant.id,
      assessmentTypeId: type.id,
      curriculumId: curriculum?.id ?? null,
      learningAreaId: learningArea?.id ?? null,
      subjectId: subject?.id ?? null,
      classId: schoolClass?.id ?? null,
      academicTermId: term?.id ?? null,
      year: term?.year ?? 2026,
      term: term?.term ?? 2,
      title: "J3 Schema Project Plan",
      description: "A flexible assessment plan can link to curriculum records.",
      instructions: "Observe, score and attach evidence.",
      weight: 20,
      maxMarks: 100,
      dueDate: "2026-07-15",
      rubricJson: JSON.stringify([{ level: 4, code: "EE", label: "Excellent" }]),
      status: "ACTIVE",
      visibleToParents: false,
      createdById: principal.id,
      createdByName: principal.fullName,
    },
  });
  assert(plan.assessmentTypeId === type.id, "AssessmentPlan links to AssessmentType");
  assert(plan.curriculumId === (curriculum?.id ?? null), "AssessmentPlan can link to J.2 Curriculum");

  const record = await db.assessmentRecord.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      studentId: student.id,
      scoreMarks: 84,
      scorePct: 84,
      rubricLevel: 4,
      rubricCode: "EE",
      narrative: "Achieng explained the method clearly and attached neat evidence.",
      status: "SCORED",
      sourceModule: "MANUAL",
      sourceId: plan.id,
      assessedById: principal.id,
      assessedByName: principal.fullName,
    },
  });
  assert(record.planId === plan.id && record.studentId === student.id, "AssessmentRecord stores one learner's marks/rubric/narrative result");

  const evidence = await db.assessmentEvidence.create({
    data: {
      tenantId: tenant.id,
      recordId: record.id,
      storedFileId: "stored-file-placeholder-for-schema-test",
      fileUrl: "/api/files/encrypted/example",
      fileName: "project-photo.jpg",
      contentType: "image/jpeg",
      evidenceType: "PHOTO",
      note: "Evidence file reference; upload path is wired in later chunks.",
      uploadedById: principal.id,
      uploadedByName: principal.fullName,
    },
  });
  assert(evidence.recordId === record.id, "AssessmentEvidence links to AssessmentRecord");

  await withTenant(tenant.id, async () => {
    const scoped = tenantDb();
    const scopedPlans = await scoped.assessmentPlan.findMany({ where: { title: "J3 Schema Project Plan" } });
    assert(scopedPlans.length === 1, "tenantDb scopes AssessmentPlan rows");
    const withRelations = await scoped.assessmentType.findUnique({ where: { id: type.id }, include: { plans: true } });
    assert(withRelations?.plans.length === 1, "AssessmentType relation returns plans");
  });

  await cleanup(tenant.id);
  console.log("\nJ.3 Chunk 1 assessment database foundation test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
