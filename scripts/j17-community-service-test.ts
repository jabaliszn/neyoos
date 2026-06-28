import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const atieno = await db.student.findFirst({ where: { firstName: "Atieno" } });
  
  if (!atieno) throw new Error("Atieno not found");

  await db.communityServiceActivity.create({
    data: {
      tenantId: khTenant.id,
      studentId: atieno.id,
      title: "Tree Planting Initiative",
      category: "ENVIRONMENT",
      date: "2026-06-25",
      hours: 4,
      location: "Karura Forest",
      supervisorName: "Wangari M.",
      studentReflection: "I learned about indigenous trees and the importance of forest cover for the Nairobi climate.",
      status: "APPROVED"
    }
  });

  await db.communityServiceActivity.create({
    data: {
      tenantId: khTenant.id,
      studentId: atieno.id,
      title: "Children's Home Visit",
      category: "CHARITY",
      date: "2026-05-10",
      hours: 6,
      location: "Nairobi Children's Home",
      supervisorName: "Sister Jane",
      studentReflection: "Helped serve lunch and organize play activities.",
      status: "APPROVED"
    }
  });

  console.log("✓ J.17 DB Seeded Community Service for Atieno (10 hours total).");
}

main().catch(console.error).finally(() => db.$disconnect());
