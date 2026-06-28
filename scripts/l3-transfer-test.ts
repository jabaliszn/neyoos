import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const originalTeacher = await db.user.findFirst({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  const newTeacher = await db.user.findFirst({ where: { email: "p.njoroge@karibuhigh.ac.ke" } });
  const eng = await db.subject.findFirst({ where: { tenantId: khTenant.id, code: "ENG" } });
  const f2e = await db.schoolClass.findFirst({ where: { tenantId: khTenant.id, level: "Form 2", stream: "East" } });
  
  if (!originalTeacher || !newTeacher || !eng || !f2e) throw new Error("Required seed data missing");

  // Step 1: Force F. Chebet to teach Form 2 East English at Period 1
  await db.classSubjectNeed.upsert({
    where: { tenantId_classId_subjectId: { tenantId: khTenant.id, classId: f2e.id, subjectId: eng.id } },
    create: { tenantId: khTenant.id, classId: f2e.id, subjectId: eng.id, lessonsPerWeek: 5, teacherId: originalTeacher.id },
    update: { teacherId: originalTeacher.id }
  });

  await db.timetableSlot.upsert({
    where: { tenantId_classId_dayOfWeek_period_slotType: { tenantId: khTenant.id, classId: f2e.id, dayOfWeek: 1, period: 1, slotType: "ACADEMIC" } },
    create: { tenantId: khTenant.id, classId: f2e.id, subjectId: eng.id, dayOfWeek: 1, period: 1, teacherId: originalTeacher.id },
    update: { teacherId: originalTeacher.id }
  });

  // Ensure P. Njoroge teaches English
  await db.teacherSubject.upsert({
    where: { tenantId_teacherId_subjectId: { tenantId: khTenant.id, teacherId: newTeacher.id, subjectId: eng.id } },
    create: { tenantId: khTenant.id, teacherId: newTeacher.id, subjectId: eng.id, isStrong: true },
    update: { isStrong: true }
  });

  const su = { id: "SYSTEM", tenantId: khTenant.id, role: "SUPER_ADMIN", fullName: "System" } as any;
  const { processTeacherTransferOut } = await import("../src/lib/services/timetable-solver.service");

  console.log("Simulating F. Chebet transferring out of the school...");
  const result = await processTeacherTransferOut(su, originalTeacher.id);
  
  console.log("✓ Algorithm processed transfer. Automatically reassigned " + result.reassignedClasses + " orphaned classes safely without AI.");

  // Verify the timetable slot was given to the new teacher (P. Njoroge)
  const updatedSlot = await db.timetableSlot.findUnique({
    where: { tenantId_classId_dayOfWeek_period_slotType: { tenantId: khTenant.id, classId: f2e.id, dayOfWeek: 1, period: 1, slotType: "ACADEMIC" } }
  });

  if (updatedSlot?.teacherId === originalTeacher.id) {
    throw new Error("Slot was not transferred from the departing teacher!");
  }
  if (!updatedSlot?.teacherId) {
    throw new Error("Algorithm failed to find a replacement teacher.");
  }

  console.log("✓ Verified: The slot on Day 1 Period 1 was seamlessly transferred to Teacher ID:", updatedSlot.teacherId);
}

main().catch(console.error).finally(() => db.$disconnect());
