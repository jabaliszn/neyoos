import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const stemCat = await db.activityCategory.upsert({
    where: { tenantId_name: { tenantId: khTenant.id, name: "STEM & Robotics" } },
    update: {},
    create: {
      tenantId: khTenant.id,
      name: "STEM & Robotics",
      color: "blue",
      maxPerWeek: 2
    }
  });

  const dramaCat = await db.activityCategory.upsert({
    where: { tenantId_name: { tenantId: khTenant.id, name: "Drama & Music" } },
    update: {},
    create: {
      tenantId: khTenant.id,
      name: "Drama & Music",
      color: "purple",
    }
  });

  // Assign STEM slot to Form 2 East on Friday period 7
  const f2e = await db.schoolClass.findFirst({ where: { tenantId: khTenant.id } });
  
  if (f2e) {
    const existingSlot = await db.timetableSlot.findFirst({
        where: { tenantId: khTenant.id, classId: f2e.id, dayOfWeek: 5, period: 7, slotType: "ACTIVITY" }
    });
    if (!existingSlot) {
        await db.timetableSlot.create({
        data: {
            tenantId: khTenant.id,
            classId: f2e.id,
            dayOfWeek: 5,
            period: 7,
            slotType: "ACTIVITY",
            activityCategoryId: stemCat.id,
            venue: "Computer Lab"
        }
        });
    }
  }

  console.log("✓ J.9 DB Seeded Activity Categories and Timetable Slots.");
}

main().catch(console.error).finally(() => db.$disconnect());
