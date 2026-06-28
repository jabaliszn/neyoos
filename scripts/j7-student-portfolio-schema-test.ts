import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";

async function main() {
  console.log("Starting J.7 Student Portfolio System schema test...");
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, status: "ACTIVE" } });

  await withTenant(tenant.id, async () => {
    // 1. Create a StoredFile representing an encrypted Storage Vault upload
    const storedFile = await tenantDb().storedFile.create({
      data: {
        key: `tenants/${tenant.id}/portfolio/art_project.png`,
        url: `https://storage.neyo.co.ke/tenants/${tenant.id}/portfolio/art_project.png`,
        fileName: "art_project.png",
        contentType: "image/png",
        size: 512000, // 512 KB
        uploadedById: principal.id,
        encrypted: true,
      } as never,
    });
    console.log("✓ created StoredFile representing encrypted Storage Vault upload");

    // 2. Create a PortfolioItem linked to the encrypted StoredFile
    const item1 = await tenantDb().portfolioItem.create({
      data: {
        studentId: student.id,
        title: "Advanced Python Geometry Calculator",
        category: "CODING",
        description: "Built a Python command line application for calculating 3D geometry formulas.",
        externalLink: "https://github.com/neyo-student/geometry-calc",
        status: "APPROVED",
        approvedById: principal.id,
        approvedByName: principal.fullName,
        approvedAt: new Date(),
        visibleToParents: true,
        createdById: principal.id,
        createdByName: principal.fullName,
      } as never,
    });
    console.log("✓ created PortfolioItem for CODING (external GitHub link, status APPROVED)");

    const item2 = await tenantDb().portfolioItem.create({
      data: {
        studentId: student.id,
        title: "Water Conservation Painting",
        category: "ART",
        description: "Watercolor painting illustrating the water cycle and conservation techniques.",
        storedFileId: storedFile.id,
        fileUrl: storedFile.url,
        fileName: storedFile.fileName,
        fileSizeBytes: storedFile.size,
        status: "SUBMITTED",
        visibleToParents: false,
        createdById: principal.id,
        createdByName: principal.fullName,
      } as never,
    });
    console.log("✓ created PortfolioItem for ART linked to encrypted StoredFile (status SUBMITTED)");

    // 3. Verify relationships and fetching by studentId
    const fetched = await tenantDb().portfolioItem.findMany({
      where: { studentId: student.id },
      include: { student: true },
      orderBy: { createdAt: "desc" },
    });
    if (fetched.length < 2) throw new Error("Portfolio items not retrieved correctly.");
    console.log(`✓ fetched ${fetched.length} Portfolio items for student ${fetched[0].student.firstName}`);

    // 4. Clean up test data
    await tenantDb().portfolioItem.delete({ where: { id: item1.id } });
    await tenantDb().portfolioItem.delete({ where: { id: item2.id } });
    await tenantDb().storedFile.delete({ where: { id: storedFile.id } });
    console.log("✓ cleaned up test data cleanly");
  });

  console.log("J.7 Chunk 1 Student Portfolio System schema test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
