import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const atieno = await db.student.findFirst({ where: { firstName: "Atieno" } });
  const teacher = await db.user.findFirst({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  
  if (!atieno || !teacher) throw new Error("Seed users not found");

  // Create a Student Goal for Atieno
  await db.studentGoal.create({
    data: {
      tenantId: khTenant.id,
      studentId: atieno.id,
      teacherId: teacher.id,
      category: "ACADEMIC",
      title: "Improve reading comprehension scores.",
      description: "Atieno will read one chapter book per week and summarize it to improve reading retention by 15%.",
      status: "ACTIVE",
    }
  });

  console.log("✓ J.13 DB Seeded Student Goals for Parent Dashboard.");
}

main().catch(console.error).finally(() => db.$disconnect());
