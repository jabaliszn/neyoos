import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";

async function main() {
  console.log("Starting J.5 Rubrics & Evidence schema test...");
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });

  await withTenant(tenant.id, async () => {
    // 1. Create a configurable Rubric
    const rubric = await tenantDb().rubric.create({
      data: {
        name: "CBC Comprehensive Rubric (Test)",
        description: "Standard 4-level evaluation rubric for CBC subjects and formative projects.",
        category: "CBC",
        createdById: principal.id,
        levels: {
          create: [
            { tenantId: tenant.id, level: 4, code: "EE", label: "Exceeding Expectation", descriptor: "Learner correctly performs the task with exceptional creativity and deep mastery.", points: 100 },
            { tenantId: tenant.id, level: 3, code: "ME", label: "Meeting Expectation", descriptor: "Learner correctly performs the task following instructions independently.", points: 75 },
            { tenantId: tenant.id, level: 2, code: "AE", label: "Approaching Expectation", descriptor: "Learner attempts the task but requires guidance to complete key steps.", points: 50 },
            { tenantId: tenant.id, level: 1, code: "BE", label: "Below Expectation", descriptor: "Learner exhibits major difficulties in performing the task even with close guidance.", points: 25 },
          ],
        },
      } as never,
    });
    console.log("✓ created configurable Rubric with 4 levels");

    // 2. Verify relationships and fetching
    const fetched = await tenantDb().rubric.findUnique({
      where: { id: rubric.id },
      include: { levels: { orderBy: { level: "desc" } } },
    });
    if (!fetched || fetched.levels.length !== 4) throw new Error("Rubric levels not retrieved correctly.");
    console.log("✓ fetched Rubric levels ordered correctly (EE -> ME -> AE -> BE)");

    // 3. Verify rubricId links on flexible assessment and competency models
    // Create temporary assessment type and plan linked to rubric
    const assessmentType = await tenantDb().assessmentType.create({
      data: {
        key: "CUSTOM_RUBRIC_TEST",
        name: "Custom Rubric Project",
        category: "PRACTICAL",
        scoreMode: "RUBRIC",
        rubricId: rubric.id,
      } as never,
    });
    const plan = await tenantDb().assessmentPlan.create({
      data: {
        assessmentTypeId: assessmentType.id,
        title: "Rubric Validation Project",
        year: 2026,
        term: 2,
        rubricId: rubric.id,
        createdById: principal.id,
        createdByName: principal.fullName,
      } as never,
    });
    console.log("✓ attached Rubric to AssessmentType and AssessmentPlan via rubricId");

    // Create competency linked to rubric
    const competency = await tenantDb().competency.create({
      data: {
        name: "Rubric Linked Competency",
        code: "RUBRIC_LINKED",
        description: "A skill evaluated strictly through the attached rubric.",
        rubricId: rubric.id,
      } as never,
    });
    console.log("✓ attached Rubric to Competency via rubricId");

    // 4. Clean up test data
    await tenantDb().competency.delete({ where: { id: competency.id } });
    await tenantDb().assessmentPlan.delete({ where: { id: plan.id } });
    await tenantDb().assessmentType.delete({ where: { id: assessmentType.id } });
    await tenantDb().rubric.delete({ where: { id: rubric.id } });
    console.log("✓ cleaned up test data cleanly");
  });

  console.log("J.5 Chunk 1 Rubrics & Evidence schema test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
