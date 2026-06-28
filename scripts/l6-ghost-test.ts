import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const atieno = await db.student.findFirst({ where: { firstName: "Atieno" } });
  const teacher = await db.user.findFirst({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  
  if (!atieno || !teacher) throw new Error("Seed users not found");

  // Force Atieno to be ACTIVE first
  await db.student.update({ where: { id: atieno.id }, data: { status: "ACTIVE" } });

  // Add an absent record on opening day (2026-09-01)
  const openingDay = "2026-09-01";
  await db.attendanceRecord.upsert({
    where: { tenantId_studentId_date: { tenantId: khTenant.id, studentId: atieno.id, date: openingDay } },
    create: {
      tenantId: khTenant.id, studentId: atieno.id, date: openingDay, status: "A",
      markedById: teacher.id, markedByName: teacher.fullName
    },
    update: { status: "A" }
  });

  const { runOpeningDayGhostSweep } = await import("../src/lib/services/opening-day.service");
  
  // We mock a user for the tenant context
  const mockUser = { tenantId: khTenant.id } as any;

  const result = await runOpeningDayGhostSweep(mockUser, openingDay);
  console.log("✓ L.6 Ghost Sweep executed. Flagged " + result.ghostsFlagged + " student(s) as UNKNOWN.");

  // Verify
  const check = await db.student.findUnique({ where: { id: atieno.id } });
  if (check?.status !== "UNKNOWN") throw new Error("Atieno was not flagged as UNKNOWN!");
}

main().catch(console.error).finally(() => db.$disconnect());
