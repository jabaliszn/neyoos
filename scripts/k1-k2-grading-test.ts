import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const teacher = await db.user.findFirst({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  const eng = await db.subject.findFirst({ where: { tenantId: khTenant.id, code: "ENG" } });
  const f2e = await db.schoolClass.findFirst({ where: { tenantId: khTenant.id, level: "Form 2", stream: "East" } });
  const atieno = await db.student.findFirst({ where: { firstName: "Atieno" } });
  const term = await db.academicTerm.findFirst({ where: { tenantId: khTenant.id, current: true } });
  
  if (!teacher || !eng || !f2e || !atieno || !term) throw new Error("Seed dependencies missing");

  // 1. Open a Marks Portal
  const openDate = new Date();
  openDate.setDate(openDate.getDate() - 1);
  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + 7);

  await db.marksPortal.create({
    data: {
      tenantId: khTenant.id,
      termId: term.id,
      name: "Term 2 End of Term Marks Entry",
      openDate,
      closeDate,
      status: "OPEN"
    }
  });

  // 2. Setup Subject Paper Config (Micro-weights)
  const { configureSubjectPapers } = await import("../src/lib/services/grading-engine.service");
  // We use teacher.id but force SUPER_ADMIN role temporarily to configure
  const su = { id: teacher.id, role: "SUPER_ADMIN", tenantId: khTenant.id, fullName: teacher.fullName } as any;
  
  const configs = await configureSubjectPapers(su, eng.id, null, [
    { name: "Paper 1 (Grammar)", outOfMarks: 40, weightPct: 40 },
    { name: "Paper 2 (Comprehension)", outOfMarks: 60, weightPct: 60 }
  ]);

  // 3. Ensure Teacher is mapped to this class via Timetable
  await db.timetableSlot.upsert({
    where: { tenantId_classId_dayOfWeek_period_slotType: { tenantId: khTenant.id, classId: f2e.id, dayOfWeek: 1, period: 1, slotType: "ACADEMIC" } },
    create: { tenantId: khTenant.id, classId: f2e.id, subjectId: eng.id, teacherId: teacher.id, dayOfWeek: 1, period: 1 },
    update: { teacherId: teacher.id, subjectId: eng.id }
  });

  // 4. Test Save Paper Results
  const { savePaperResults } = await import("../src/lib/services/grading-engine.service");
  
  // Need an Exam to map results to
  const exam = await db.exam.findFirst({ where: { tenantId: khTenant.id } });
  if (!exam) throw new Error("Exam not found");

  const tu = { id: teacher.id, role: "TEACHER", tenantId: khTenant.id, fullName: teacher.fullName } as any;

  try {
    // Attempt invalid (45 out of 40)
    await savePaperResults(tu, exam.id, eng.id, f2e.id, [
      { studentId: atieno.id, paperConfigId: configs[0].id, marksScored: 45 }
    ]);
    throw new Error("Should have thrown validation error");
  } catch (e: any) {
    if (e.code === "INVALID") {
      console.log("✓ Guard verified: Blocked entering marks higher than the 'Out Of' limit.");
    } else {
      throw e;
    }
  }

  // Attempt valid
  await savePaperResults(tu, exam.id, eng.id, f2e.id, [
    { studentId: atieno.id, paperConfigId: configs[0].id, marksScored: 38 },
    { studentId: atieno.id, paperConfigId: configs[1].id, marksScored: 55 }
  ]);
  console.log("✓ J.K1 & K.2 DB Seeded Multi-Paper marks successfully entered.");
}

main().catch(console.error).finally(() => db.$disconnect());
