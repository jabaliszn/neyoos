import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const sections = [
    { id: "1", type: "HEADER" },
    { id: "2", type: "COMPETENCIES" },
    { id: "3", type: "TALENTS" },
    { id: "4", type: "ATTENDANCE" },
    { id: "5", type: "TEACHER_REMARKS" },
    { id: "6", type: "PRINCIPAL_REMARKS" }
  ];

  await db.reportTemplate.create({
    data: {
      tenantId: khTenant.id,
      name: "CBC Comprehensive Term Report",
      description: "Combines academic CBC competencies with co-curricular talents and attendance.",
      isDefault: true,
      sectionsJson: JSON.stringify(sections)
    }
  });

  const marksSections = [
    { id: "1", type: "HEADER" },
    { id: "2", type: "ACADEMIC_MARKS" },
    { id: "3", type: "DISCIPLINE" },
    { id: "4", type: "TEACHER_REMARKS" }
  ];

  await db.reportTemplate.create({
    data: {
      tenantId: khTenant.id,
      name: "Standard 8-4-4 Scorecard",
      description: "Traditional marks and behavior report.",
      isDefault: false,
      sectionsJson: JSON.stringify(marksSections)
    }
  });

  console.log("✓ J.15 DB Seeded Modular Report Templates.");
}

main().catch(console.error).finally(() => db.$disconnect());
