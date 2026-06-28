import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const classes = await db.schoolClass.findMany({ where: { tenantId: khTenant.id } });

  // Update Timetable configs to use 10 periods and 2 short breaks for L.1 & L.2
  for (const cls of classes) {
    await db.timetableConfig.upsert({
      where: { classId: cls.id },
      create: {
        tenantId: khTenant.id,
        classId: cls.id,
        periodsPerDay: 10,
        shortBreakStart: 2,
        shortBreak2Start: 5, // Afternoon break after period 5
        lunchStart: 7, // Lunch after period 7
        saturdayEarlyHome: true,
        saturdayEndTime: "13:00"
      },
      update: {
        periodsPerDay: 10,
        shortBreakStart: 2,
        shortBreak2Start: 5,
        lunchStart: 7,
        saturdayEarlyHome: true,
        saturdayEndTime: "13:00"
      }
    });
  }

  console.log("✓ L.1 & L.2 Configured classes with 10 periods, double short-breaks, and late lunch.");
}

main().catch(console.error).finally(() => db.$disconnect());
