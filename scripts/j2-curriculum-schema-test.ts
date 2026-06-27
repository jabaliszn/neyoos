import { db } from "../src/lib/db";
import { TENANT_OWNED_MODELS } from "../src/lib/core/tenant-tables";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const tenant = await db.tenant.findFirst({ where: { slug: "karibu-high" } });
  assert(tenant, "seed tenant exists");
  const tenantId = tenant!.id;

  const needed = ["curriculum", "educationLevel", "gradeBand", "learningArea"];
  for (const model of needed) {
    assert((TENANT_OWNED_MODELS as readonly string[]).includes(model), `${model} is tenant-owned`);
  }

  const curriculum = await db.curriculum.create({
    data: {
      tenantId,
      name: "J2 Test Curriculum",
      country: "Kenya",
      context: "Schema smoke test",
      activeVersion: "2026-test",
      effectiveFrom: "2026-01-01",
      notes: "Created by scripts/j2-curriculum-schema-test.ts",
    },
  });
  assert(curriculum.id, "Curriculum row creates with real DB");

  const level = await db.educationLevel.create({
    data: {
      tenantId,
      curriculumId: curriculum.id,
      name: "Junior School Test",
      levelKey: "junior",
      sequence: 3,
    },
  });
  assert(level.curriculumId === curriculum.id, "EducationLevel links to Curriculum");

  const grade = await db.gradeBand.create({
    data: {
      tenantId,
      curriculumId: curriculum.id,
      educationLevelId: level.id,
      name: "Grade 7 Test",
      shortName: "G7T",
      sequence: 7,
    },
  });
  assert(grade.educationLevelId === level.id, "GradeBand links to EducationLevel");

  const learningArea = await db.learningArea.create({
    data: {
      tenantId,
      curriculumId: curriculum.id,
      name: "Integrated Learning Test",
      code: "J2T",
      description: "Schema smoke-test area",
    },
  });
  assert(learningArea.curriculumId === curriculum.id, "LearningArea links to Curriculum");

  const subject = await db.subject.findFirst({ where: { tenantId } });
  assert(subject, "existing Subject rows remain readable");
  if (subject) {
    await db.subject.update({ where: { id: subject.id }, data: { curriculumId: curriculum.id, learningAreaId: learningArea.id } });
    const mapped = await db.subject.findUnique({ where: { id: subject.id } });
    assert(mapped?.curriculumId === curriculum.id && mapped?.learningAreaId === learningArea.id, "Subject maps to Curriculum + LearningArea");
    await db.subject.update({ where: { id: subject.id }, data: { curriculumId: null, learningAreaId: null } });
  }

  const schoolClass = await db.schoolClass.findFirst({ where: { tenantId } });
  assert(schoolClass, "existing SchoolClass rows remain readable");
  if (schoolClass) {
    await db.schoolClass.update({ where: { id: schoolClass.id }, data: { curriculumId: curriculum.id, gradeBandId: grade.id } });
    const mapped = await db.schoolClass.findUnique({ where: { id: schoolClass.id } });
    assert(mapped?.curriculumId === curriculum.id && mapped?.gradeBandId === grade.id, "SchoolClass maps to Curriculum + GradeBand");
    await db.schoolClass.update({ where: { id: schoolClass.id }, data: { curriculumId: null, gradeBandId: null } });
  }

  await withTenant(tenantId, async () => {
    const scoped = tenantDb();
    const scopedCurricula = await scoped.curriculum.findMany({ where: { name: "J2 Test Curriculum" } });
    assert(scopedCurricula.length === 1, "tenantDb scopes Curriculum rows");
  });

  await db.learningArea.delete({ where: { id: learningArea.id } });
  await db.gradeBand.delete({ where: { id: grade.id } });
  await db.educationLevel.delete({ where: { id: level.id } });
  await db.curriculum.delete({ where: { id: curriculum.id } });

  console.log("\nJ.2 Chunk 1 schema foundation test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
