import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const math = await db.subject.findFirst({ where: { tenantId: khTenant.id, code: "MAT" } });
  const phy = await db.subject.findFirst({ where: { tenantId: khTenant.id, code: "PHY" } });
  
  if (!math || !phy) throw new Error("Subjects not found");

  // Create STEM Pathway
  const stem = await db.pathway.upsert({
    where: { tenantId_code: { tenantId: khTenant.id, code: "STEM" } },
    update: {},
    create: {
      tenantId: khTenant.id,
      name: "STEM (Science, Tech, Engineering, Math)",
      code: "STEM",
      capacity: 40,
      subjectRequirements: {
        create: [
          { tenantId: khTenant.id, subjectId: math.id, isCore: true, minScorePct: 70 },
          { tenantId: khTenant.id, subjectId: phy.id, isCore: true, minScorePct: 65 }
        ]
      }
    }
  });

  // Create Arts Pathway
  const arts = await db.pathway.upsert({
    where: { tenantId_code: { tenantId: khTenant.id, code: "ARTS" } },
    update: {},
    create: {
      tenantId: khTenant.id,
      name: "Creative Arts & Sports",
      code: "ARTS",
    }
  });

  // Assign Student Preference for Achieng
  const achieng = await db.student.findFirst({ where: { firstName: "Achieng" } });
  if (achieng) {
    await db.studentPathwayPreference.upsert({
      where: { tenantId_studentId_pathwayId: { tenantId: khTenant.id, studentId: achieng.id, pathwayId: stem.id } },
      update: { choiceOrder: 1, isAllocated: true, isRecommended: true, teacherNotes: "Strong aptitude in Math and Physics." },
      create: {
        tenantId: khTenant.id,
        studentId: achieng.id,
        pathwayId: stem.id,
        choiceOrder: 1,
        isAllocated: true,
        isRecommended: true,
        teacherNotes: "Strong aptitude in Math and Physics."
      }
    });
  }

  console.log("✓ J.10 DB Seeded Senior Pathways & Preferences.");
}

main().catch(console.error).finally(() => db.$disconnect());
