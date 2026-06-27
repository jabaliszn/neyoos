import { db } from "../src/lib/db";
import { TENANT_OWNED_MODELS } from "../src/lib/core/tenant-tables";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function cleanup(tenantId: string) {
  await db.competencyEvidence.deleteMany({ where: { tenantId, sourceModule: "J4_SCHEMA_TEST" } });
  await db.competency.deleteMany({ where: { tenantId, code: { startsWith: "J4_" } } });
  await db.competencyGroup.deleteMany({ where: { tenantId, code: { startsWith: "J4_" } } });
}

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, status: "ACTIVE", deletedAt: null } });
  const curriculum = await db.curriculum.findFirst({ where: { tenantId: tenant.id } });
  const learningArea = await db.learningArea.findFirst({ where: { tenantId: tenant.id } });
  const assessmentRecord = await db.assessmentRecord.findFirst({ where: { tenantId: tenant.id } });
  const cbcAssessment = await db.cbcAssessment.findFirst({ where: { tenantId: tenant.id } });

  await cleanup(tenant.id);

  for (const model of ["competencyGroup", "competency", "competencyEvidence"]) {
    assert((TENANT_OWNED_MODELS as readonly string[]).includes(model), `${model} is tenant-owned`);
  }

  const group = await db.competencyGroup.create({
    data: {
      tenantId: tenant.id,
      curriculumId: curriculum?.id ?? null,
      name: "J4 Core Competencies",
      code: "J4_CORE",
      description: "Schema test group for configurable competencies.",
      sequence: 1,
      active: true,
    },
  });
  assert(group.id && group.curriculumId === (curriculum?.id ?? null), "CompetencyGroup creates and can link to Curriculum");

  const competency = await db.competency.create({
    data: {
      tenantId: tenant.id,
      groupId: group.id,
      curriculumId: curriculum?.id ?? null,
      learningAreaId: learningArea?.id ?? null,
      name: "J4 Communication",
      code: "J4_COMMUNICATION",
      description: "Learner explains ideas clearly and listens actively.",
      sequence: 1,
      active: true,
    },
  });
  assert(competency.groupId === group.id, "Competency links to CompetencyGroup");
  assert(competency.learningAreaId === (learningArea?.id ?? null), "Competency can optionally link to LearningArea");

  const evidence = await db.competencyEvidence.create({
    data: {
      tenantId: tenant.id,
      competencyId: competency.id,
      studentId: student.id,
      sourceModule: "J4_SCHEMA_TEST",
      sourceId: assessmentRecord?.id ?? cbcAssessment?.id ?? "manual-source",
      assessmentRecordId: assessmentRecord?.id ?? null,
      cbcAssessmentId: cbcAssessment?.id ?? null,
      level: 4,
      scorePct: 88,
      narrative: "Achieng explained the answer clearly and used examples.",
      evidenceDate: "2026-07-01",
      recordedById: principal.id,
      recordedByName: principal.fullName,
      approved: true,
      visibleToParents: true,
    },
  });
  assert(evidence.competencyId === competency.id && evidence.studentId === student.id, "CompetencyEvidence links learner to competency");
  assert(evidence.assessmentRecordId === (assessmentRecord?.id ?? null), "CompetencyEvidence can reference J.3 AssessmentRecord when present");
  assert(evidence.cbcAssessmentId === (cbcAssessment?.id ?? null), "CompetencyEvidence can reference B.6 CbcAssessment when present");

  await withTenant(tenant.id, async () => {
    const scoped = tenantDb();
    const rows = await scoped.competency.findMany({ where: { code: "J4_COMMUNICATION" }, include: { evidence: true } });
    assert(rows.length === 1, "tenantDb scopes Competency rows");
    assert(rows[0].evidence.length === 1, "Competency relation returns evidence rows");
  });

  await cleanup(tenant.id);
  console.log("\nJ.4 Chunk 1 competency database foundation test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
