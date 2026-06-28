import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const atieno = await db.student.findFirst({ where: { firstName: "Atieno" } });
  
  if (!atieno) throw new Error("Atieno not found");

  // Create a pending Transfer Passport export
  await db.transferPassportRequest.create({
    data: {
      sourceTenantId: khTenant.id,
      destinationEmail: "admissions@nairobihigh.ac.ke",
      studentId: atieno.id,
      studentName: "Atieno Owino",
      accessCode: "93821045",
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      status: "PENDING",
      includedModules: JSON.stringify(["ACADEMIC", "ATTENDANCE", "MEDICAL"]),
      consentBy: "Owino Otieno",
      payloadJson: JSON.stringify({
        profile: { admissionNo: atieno.admissionNo, firstName: "Atieno", lastName: "Owino" },
        message: "Simulated payload snapshot"
      })
    }
  });

  console.log("✓ J.14 DB Seeded Transfer Passport Request.");
}

main().catch(console.error).finally(() => db.$disconnect());
