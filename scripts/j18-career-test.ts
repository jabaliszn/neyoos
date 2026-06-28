import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const atieno = await db.student.findFirst({ where: { firstName: "Atieno" } });
  const teacher = await db.user.findFirst({ where: { email: "p.njoroge@karibuhigh.ac.ke" } });
  
  if (!atieno || !teacher) throw new Error("Atieno or Teacher not found");

  // 1. Log a student interest
  await db.careerDiscoveryRecord.create({
    data: {
      tenantId: khTenant.id,
      studentId: atieno.id,
      recordType: "STUDENT_INTEREST",
      careerArea: "Medicine & Healthcare",
      notes: "Expressed a strong desire to become a pediatrician.",
      recordedById: teacher.id,
      recordedByName: teacher.fullName
    }
  });

  // 2. Log a parent conversation
  await db.careerDiscoveryRecord.create({
    data: {
      tenantId: khTenant.id,
      studentId: atieno.id,
      recordType: "PARENT_CONVERSATION",
      careerArea: "Engineering & Technology",
      notes: "Parents discussed the viability of aeronautical engineering over medicine.",
      recordedById: teacher.id,
      recordedByName: teacher.fullName
    }
  });

  // 3. Log a teacher recommendation
  await db.careerDiscoveryRecord.create({
    data: {
      tenantId: khTenant.id,
      studentId: atieno.id,
      recordType: "TEACHER_RECOMMENDATION",
      careerArea: "Engineering & Technology",
      notes: "Atieno's math scores strongly align with engineering. I recommend she pursues the STEM pathway.",
      recordedById: teacher.id,
      recordedByName: teacher.fullName
    }
  });

  console.log("✓ J.18 DB Seeded Career Discovery Timeline for Atieno.");
}

main().catch(console.error).finally(() => db.$disconnect());
