import { db } from "../src/lib/db";

async function main() {
  console.log("Starting J.7 Student Portfolio seed test...");

  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const achiengUser = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "achieng@karibuhigh.ac.ke" } });
  const achieng = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, userId: achiengUser.id } });
  const atieno = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Atieno" } });

  const approvedTitle = "Nairobi River clean-up reflection";
  const submittedTitle = "Scratch coding fractions animation";
  const certificateTitle = "County music festival certificate";

  const approved = await db.portfolioItem.findMany({ where: { tenantId: tenant.id, studentId: achieng.id, title: approvedTitle } });
  if (approved.length !== 1) throw new Error(`Expected exactly 1 seeded approved item for Achieng, found ${approved.length}`);
  if (approved[0].status !== "APPROVED" || !approved[0].visibleToParents) throw new Error("Approved portfolio seed should be APPROVED and family-visible.");
  if (!approved[0].competencyId || !approved[0].subjectId) throw new Error("Approved portfolio seed should link to a real competency and subject.");
  console.log("✓ seeded approved family-visible portfolio item exists for Achieng with competency/subject links");

  const submitted = await db.portfolioItem.findMany({ where: { tenantId: tenant.id, studentId: achieng.id, title: submittedTitle } });
  if (submitted.length !== 1) throw new Error(`Expected exactly 1 seeded submitted item for Achieng, found ${submitted.length}`);
  if (submitted[0].status !== "SUBMITTED" || submitted[0].visibleToParents) throw new Error("Student-submitted seed should stay SUBMITTED and hidden from parents.");
  if ((submitted[0].fileSizeBytes ?? 0) <= 0) throw new Error("Submitted seed should carry file-size metadata for storage UX demo.");
  console.log("✓ seeded student-submitted hidden portfolio item exists for Achieng with storage metadata");

  const certificate = await db.portfolioItem.findMany({ where: { tenantId: tenant.id, studentId: atieno.id, title: certificateTitle } });
  if (certificate.length !== 1) throw new Error(`Expected exactly 1 seeded certificate item for Atieno, found ${certificate.length}`);
  if (certificate[0].status !== "APPROVED" || !certificate[0].visibleToParents) throw new Error("Certificate seed should be APPROVED and visible to parents.");
  if (!certificate[0].awardId || !certificate[0].clubId) throw new Error("Certificate seed should demonstrate club/award linking.");
  console.log("✓ seeded certificate portfolio item exists for Atieno with club/award links");

  const learnerItems = await db.portfolioItem.findMany({
    where: { tenantId: tenant.id, studentId: { in: [achieng.id, atieno.id] } },
    orderBy: { createdAt: "asc" },
  });
  if (learnerItems.length < 3) throw new Error(`Expected at least 3 seeded portfolio items across learners, found ${learnerItems.length}`);
  console.log(`✓ seeded portfolio timeline is non-empty by default (${learnerItems.length} items found)`);

  console.log("J.7 Chunk 8 Student Portfolio seed test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
