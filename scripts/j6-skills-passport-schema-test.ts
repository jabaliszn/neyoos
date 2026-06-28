import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";

async function main() {
  console.log("Starting J.6 Skills Passport schema test...");
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, status: "ACTIVE" } });

  await withTenant(tenant.id, async () => {
    // 1. Create a Skills Passport entry for Leadership
    const entry1 = await tenantDb().skillsPassportEntry.create({
      data: {
        studentId: student.id,
        skillArea: "Leadership",
        ratingLevel: 5,
        evidenceSource: "CLUB",
        narrative: "Elected as Form 2 East Class Prefect and leads the morning assembly discipline squad effectively.",
        evidenceDate: "2026-06-25",
        recordedById: principal.id,
        recordedByName: principal.fullName,
      } as never,
    });
    console.log("✓ created Skills Passport entry for Leadership (5 stars, source CLUB)");

    // 2. Create a Skills Passport entry for Coding
    const entry2 = await tenantDb().skillsPassportEntry.create({
      data: {
        studentId: student.id,
        skillArea: "Coding",
        ratingLevel: 4,
        evidenceSource: "PORTFOLIO",
        narrative: "Completed Python fundamentals project and deployed a simple calculator app.",
        evidenceDate: "2026-06-26",
        recordedById: principal.id,
        recordedByName: principal.fullName,
      } as never,
    });
    console.log("✓ created Skills Passport entry for Coding (4 stars, source PORTFOLIO)");

    // 3. Verify relationships and fetching by studentId
    const fetched = await tenantDb().skillsPassportEntry.findMany({
      where: { studentId: student.id },
      include: { student: true },
      orderBy: { evidenceDate: "desc" },
    });
    if (fetched.length < 2) throw new Error("Skills Passport entries not retrieved correctly.");
    console.log(`✓ fetched ${fetched.length} Skills Passport entries for student ${fetched[0].student.firstName}`);

    // 4. Clean up test data
    await tenantDb().skillsPassportEntry.delete({ where: { id: entry1.id } });
    await tenantDb().skillsPassportEntry.delete({ where: { id: entry2.id } });
    console.log("✓ cleaned up test data cleanly");
  });

  console.log("J.6 Chunk 1 Skills Passport schema test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
