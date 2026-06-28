import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const learningAreas = [
    { name: "Mathematics", code: "MAT", description: "Core math" },
    { name: "English Language", code: "ENG", description: "Core language" },
    { name: "Integrated Science", code: "ISC", description: "Combined science" },
    { name: "Pre-Technical Studies", code: "PRETECH", description: "Technical skills" }
  ];

  await db.globalCurriculumTemplate.create({
    data: {
      name: "CBC Kenya Junior School (Grade 7-9)",
      country: "Kenya",
      context: "Junior School",
      version: "2026 Release",
      description: "The official KICD approved structure for Junior School containing mandatory core subjects.",
      status: "PUBLISHED",
      learningAreasJson: JSON.stringify(learningAreas)
    }
  });

  console.log("✓ J.21 DB Seeded Global Curriculum Template from NEYO Ops.");
}

main().catch(console.error).finally(() => db.$disconnect());
