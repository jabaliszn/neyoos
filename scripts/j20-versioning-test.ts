import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const original = await db.curriculum.findFirst({ where: { tenantId: khTenant.id, status: "ACTIVE" } });
  
  if (!original) throw new Error("No active curriculum found");

  // 1. Create a DRAFT clone
  const draft = await db.curriculum.create({
    data: {
      tenantId: khTenant.id,
      name: original.name,
      country: original.country,
      context: original.context,
      activeVersion: "CBC 2027 Beta",
      status: "DRAFT",
      isActive: false,
      previousVersionId: original.id,
      learningAreas: {
        create: [
          { tenantId: khTenant.id, name: "Advanced AI Ethics", code: "AIE" },
          { tenantId: khTenant.id, name: "Mathematics", code: "MAT" }
        ]
      }
    }
  });

  console.log("✓ J.20 DB Seeded DRAFT Curriculum Version. ID:", draft.id);
}

main().catch(console.error).finally(() => db.$disconnect());
