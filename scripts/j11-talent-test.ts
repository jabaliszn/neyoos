import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const atieno = await db.student.findFirst({ where: { firstName: "Atieno" } });
  const coach = await db.user.findFirst({ where: { email: "p.njoroge@karibuhigh.ac.ke" } }); // Using Teacher Peter Njoroge as a coach
  
  if (!atieno || !coach) throw new Error("Atieno or Coach not found");

  // Create Talent Areas
  const football = await db.talentArea.upsert({
    where: { tenantId_name: { tenantId: khTenant.id, name: "Football" } },
    update: {},
    create: {
      tenantId: khTenant.id,
      name: "Football",
      category: "SPORTS",
      description: "School Football Team and Athletics"
    }
  });

  const drama = await db.talentArea.upsert({
    where: { tenantId_name: { tenantId: khTenant.id, name: "Drama & Theater" } },
    update: {},
    create: {
      tenantId: khTenant.id,
      name: "Drama & Theater",
      category: "ARTS",
    }
  });

  // Record a talent evaluation for Atieno in Football
  await db.talentRecord.create({
    data: {
      tenantId: khTenant.id,
      studentId: atieno.id,
      talentAreaId: football.id,
      coachId: coach.id,
      score: 85,
      notes: "Excellent midfield control. Has shown great leadership potential as team captain this term.",
    }
  });

  // Record Drama participation
  await db.talentRecord.create({
    data: {
      tenantId: khTenant.id,
      studentId: atieno.id,
      talentAreaId: drama.id,
      coachId: coach.id,
      notes: "Participated in the Kenya National Drama Festival regional qualifiers.",
    }
  });

  console.log("✓ J.11 DB Seeded Talent Areas & Tracking Records.");
}

main().catch(console.error).finally(() => db.$disconnect());
