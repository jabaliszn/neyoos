import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  // Get subjects
  const math = await db.subject.findFirst({ where: { tenantId: khTenant.id, code: "MAT" } });
  const eng = await db.subject.findFirst({ where: { tenantId: khTenant.id, code: "ENG" } });
  const bio = await db.subject.findFirst({ where: { tenantId: khTenant.id, name: "Biology" } });
  const phy = await db.subject.findFirst({ where: { tenantId: khTenant.id, code: "PHY" } });
  
  if (!math || !eng || !bio || !phy) throw new Error("Seed subjects missing");

  // 1. Open Portal
  const openDate = new Date();
  openDate.setDate(openDate.getDate() - 1);
  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + 14);

  const portal = await db.subjectSelectionPortal.create({
    data: {
      tenantId: khTenant.id,
      name: "Form 3 Subject Selections (Science Track)",
      targetLevel: "Form 3",
      openDate,
      closeDate,
      status: "OPEN",
      rulesJson: JSON.stringify({
        minElectives: 2,
        maxElectives: 2,
        compulsorySubjectIds: [math.id, eng.id],
        electiveSubjectIds: [bio.id, phy.id]
      })
    }
  });

  // 2. Simulate Student picking subjects
  const atieno = await db.student.findFirst({ where: { firstName: "Atieno" } });
  if (atieno) {
    const { submitStudentSelections } = await import("../src/lib/services/subject-selection.service");
    const parentUser = { tenantId: khTenant.id, role: "PARENT" } as any;

    try {
      // Pick only 1 elective (Should fail, needs 2)
      await submitStudentSelections(parentUser, portal.id, atieno.id, [bio.id]);
      throw new Error("Should have thrown minElectives error");
    } catch (e: any) {
      if (e.code === "INVALID") console.log("✓ Guard verified: Blocked selecting too few electives.");
      else throw e;
    }

    // Pick 2 electives (Valid)
    await submitStudentSelections(parentUser, portal.id, atieno.id, [bio.id, phy.id]);
    console.log("✓ Valid student selections saved.");
  }

  // 3. Generate Report
  const { getSelectionReport } = await import("../src/lib/services/subject-selection.service");
  const adminUser = { tenantId: khTenant.id, role: "SUPER_ADMIN" } as any;
  const report = await getSelectionReport(adminUser, portal.id);

  console.log("✓ Academics Report Generated. Total selections logged:", report.studentSelections.length);
}

main().catch(console.error).finally(() => db.$disconnect());
