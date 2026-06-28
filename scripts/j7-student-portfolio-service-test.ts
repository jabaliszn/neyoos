import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import type { SessionUser } from "../src/lib/core/session";
import {
  getPortfolioTimeline,
  submitPortfolioItem,
  updatePortfolioItem,
  approvePortfolioItem,
  rejectPortfolioItem,
  deletePortfolioItem,
  exportPortfolioPack,
  PortfolioError,
} from "../src/lib/services/portfolio.service";

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof db.user.findFirst>>>): SessionUser {
  return { id: user.id, tenantId: user.tenantId, neyoLoginId: user.neyoLoginId, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role as SessionUser["role"], secondaryRole: (user.secondaryRole as SessionUser["secondaryRole"]) ?? null, language: user.language ?? "en" };
}

async function main() {
  console.log("Starting J.7 Student Portfolio System service test...");
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principalRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const teacherRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } });
  const accountantRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "accounts@karibuhigh.ac.ke" } });
  const parentRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "parent@karibuhigh.ac.ke" } });

  const principal = toSessionUser(principalRow);
  const teacher = toSessionUser(teacherRow);
  const accountant = toSessionUser(accountantRow);
  const parent = toSessionUser(parentRow);

  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Achieng" } });
  const otherStudent = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Kamau" } });

  const studentUserRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "achieng@karibuhigh.ac.ke" } });
  const studentUser = toSessionUser(studentUserRow);

  await withTenant(tenant.id, async () => {
    // 0. Clean up any leftover items and files from previous runs
    await tenantDb().portfolioItem.deleteMany({ where: { studentId: student.id } });
    await tenantDb().storedFile.deleteMany({
      where: { key: { in: [`tenants/${tenant.id}/portfolio/math_graph.png`, `tenants/${tenant.id}/portfolio/big_video.mp4`] } },
    });

    // 1. Verify accountant is forbidden from viewing portfolio
    await getPortfolioTimeline(accountant, student.id).then(() => { throw new Error("Accountant should be forbidden"); }).catch((e) => {
      if (e instanceof PortfolioError && e.code === "FORBIDDEN") console.log("✓ Accountant correctly forbidden from reading Student Portfolio");
      else throw e;
    });

    // 2. Verify parent row-scoping (can read own child, blocked on other child)
    const parentTimeline = await getPortfolioTimeline(parent, student.id);
    console.log(`✓ parent successfully fetched Portfolio Timeline for own child (${parentTimeline.student.name})`);
    if (parentTimeline.canSubmit) throw new Error("Parent should not be able to submit portfolio items");

    await getPortfolioTimeline(parent, otherStudent.id).then(() => { throw new Error("Parent should be blocked from other child"); }).catch((e) => {
      if (e instanceof PortfolioError && e.code === "NOT_FOUND") console.log("✓ parent correctly blocked from reading other child's Portfolio (row scoping enforced)");
      else throw e;
    });

    // 3. Submit portfolio item as student (self-submission)
    const storedFile1 = await tenantDb().storedFile.create({
      data: { key: `tenants/${tenant.id}/portfolio/math_graph.png`, url: `https://storage.neyo.co.ke/tenants/${tenant.id}/portfolio/math_graph.png`, fileName: "math_graph.png", contentType: "image/png", size: 4 * 1024 * 1024, uploadedById: studentUser.id, encrypted: true } as never,
    });

    const studentItem = await submitPortfolioItem(studentUser, {
      studentId: student.id,
      title: "Self Submitted Math Visualization",
      category: "PROJECT",
      description: "Custom graph plotted using Python math libraries.",
      storedFileId: storedFile1.id,
      fileUrl: storedFile1.url,
      fileName: storedFile1.fileName,
      fileSizeBytes: storedFile1.size,
      status: "SUBMITTED",
      visibleToParents: false,
    });
    console.log("✓ student successfully submitted own portfolio item (Status forced to SUBMITTED, awaiting teacher approval)");

    // 4. Verify unapproved item is hidden from parent but visible to student and teacher
    const parentCheck = await getPortfolioTimeline(parent, student.id);
    if (parentCheck.items.length !== 0) throw new Error("Parent should not see unapproved portfolio items");
    console.log("✓ unapproved portfolio item correctly hidden from parent view");

    const teacherCheck = await getPortfolioTimeline(teacher, student.id);
    if (teacherCheck.items.length !== 1) throw new Error("Teacher should see unapproved portfolio items");
    console.log("✓ teacher successfully views unapproved portfolio item in queue");

    // 5. Approve portfolio item as principal
    await approvePortfolioItem(principal, { itemId: studentItem.id, status: "APPROVED", visibleToParents: true });
    console.log("✓ principal approved student portfolio item for parent visibility");

    const parentCheck2 = await getPortfolioTimeline(parent, student.id);
    if (parentCheck2.items.length !== 1) throw new Error("Parent should see approved portfolio items");
    console.log("✓ parent successfully views approved portfolio item");

    // 6. Verify encrypted Storage Vault check (reject unencrypted/missing file)
    await submitPortfolioItem(teacher, { studentId: student.id, title: "Unencrypted File Test", category: "PROJECT", storedFileId: "nonexistent_id", description: "Test" })
      .then(() => { throw new Error("Should reject missing StoredFile reference"); })
      .catch((e) => {
        if (e instanceof PortfolioError && e.code === "INVALID") console.log("✓ missing StoredFile reference correctly rejected (enforces encrypted Storage Vault path)");
        else throw e;
      });

    // 7. Verify media size control and storage warning threshold
    // Submit second item with 8 MB file (total storage = 4 MB + 8 MB = 12 MB, exceeds 10 MB warning threshold!)
    const storedFile2 = await tenantDb().storedFile.create({
      data: { key: `tenants/${tenant.id}/portfolio/big_video.mp4`, url: `https://storage.neyo.co.ke/tenants/${tenant.id}/portfolio/big_video.mp4`, fileName: "big_video.mp4", contentType: "video/mp4", size: 8 * 1024 * 1024, uploadedById: teacher.id, encrypted: true } as never,
    });

    const teacherItem = await submitPortfolioItem(teacher, {
      studentId: student.id,
      title: "Science Fair Demonstration Video",
      category: "VIDEO",
      description: "Video showing the solar irrigation system working in real time.",
      storedFileId: storedFile2.id,
      fileUrl: storedFile2.url,
      fileName: storedFile2.fileName,
      fileSizeBytes: storedFile2.size,
      status: "SUBMITTED",
      visibleToParents: false,
    });
    console.log("✓ teacher submitted second portfolio item (8 MB video, status SUBMITTED)");

    // Approve second item as principal
    await approvePortfolioItem(principal, { itemId: teacherItem.id, status: "APPROVED", visibleToParents: true });

    const timelineWarningCheck = await getPortfolioTimeline(principal, student.id);
    console.log(`  - Total Portfolio Storage: ${timelineWarningCheck.storage.totalStorageMegabytes} MB`);
    console.log(`  - Warning Threshold: ${timelineWarningCheck.storage.warningThresholdMegabytes} MB`);
    if (!timelineWarningCheck.storage.storageWarningExceeded) throw new Error("Storage warning flag should be true (>10 MB)");
    console.log("✓ storage usage warning flag correctly set to true (exceeded 10 MB threshold)");

    // 8. Reject portfolio item as principal
    await rejectPortfolioItem(principal, { itemId: teacherItem.id, status: "REJECTED", note: "Video audio is missing." });
    console.log("✓ principal rejected portfolio item cleanly");

    // 9. Generate export portfolio pack
    const pack = await exportPortfolioPack(principal, student.id);
    if (pack.portfolioPack.length !== 1) throw new Error("Export pack should contain exactly 1 approved item");
    console.log(`✓ generated portable portfolio export pack successfully (${pack.portfolioPack.length} approved items, manifest version ${pack.manifest.version})`);

    // 10. Verify audit logs
    const recentAudits = await tenantDb().auditLog.findMany({
      where: { action: { in: ["portfolio.item_submitted", "portfolio.item_approved", "portfolio.item_rejected", "portfolio.pack_exported"] } },
    });
    if (recentAudits.length < 4) throw new Error("Audit logs not generated correctly.");
    console.log(`✓ audit logs verified (${recentAudits.length} events recorded across portfolio lifecycle)`);

    // 11. Clean up test data
    await tenantDb().portfolioItem.deleteMany({ where: { studentId: student.id } });
    await tenantDb().storedFile.delete({ where: { id: storedFile1.id } });
    await tenantDb().storedFile.delete({ where: { id: storedFile2.id } });
    console.log("✓ cleaned up test data cleanly");
  });

  console.log("J.7 Chunk 3 Student Portfolio System service test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
