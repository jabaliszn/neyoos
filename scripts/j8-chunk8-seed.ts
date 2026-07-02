import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("KH tenant not found");

  const atieno = await db.student.findFirst({ where: { firstName: "Atieno" } });
  const teacher = await db.user.findFirst({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  
  if (!atieno || !teacher) throw new Error("Atieno or Teacher not found");

  // Add a Flexible Assessment plan and record for J.8
  const assessmentType = await db.assessmentType.findFirst({ where: { tenantId: khTenant.id, key: "PROJECT" } }) ||
                  await db.assessmentType.create({
                    data: {
                      tenantId: khTenant.id,
                      name: "Term Project",
                      key: "PROJECT",
                    }
                  });

  const plan = await db.assessmentPlan.create({
    data: {
      tenantId: khTenant.id,
      assessmentTypeId: assessmentType.id,
      title: "Science Fair Demo",
      year: 2026,
      term: 2,
      maxMarks: 100,
      createdById: teacher.id,
      createdByName: teacher.fullName || "Teacher",
      status: "PUBLISHED",
      visibleToParents: true,
    }
  });

  await db.assessmentRecord.create({
    data: {
      tenantId: khTenant.id,
      planId: plan.id,
      studentId: atieno.id,
      scoreMarks: 92,
      rubricLevel: 4,
      narrative: "Outstanding practical demonstration of circuitry.",
      assessedById: teacher.id,
      assessedByName: teacher.fullName || "Teacher",
      assessedAt: new Date("2026-06-20T10:00:00Z"),
      status: "PUBLISHED",
      releasedAt: new Date("2026-06-21T10:00:00Z"),
    }
  });

  // Add a minor Discipline event (B.20)
  const minorIncident = await db.disciplineIncident.create({
    data: {
      tenantId: khTenant.id,
      studentId: atieno.id,
      studentName: atieno.firstName + " " + atieno.lastName,
      admissionNo: atieno.admissionNo,
      reportedById: teacher.id,
      reportedByName: teacher.fullName || "Teacher",
      date: "2026-06-22",
      category: "MINOR",
      severity: "LOW",
      description: "Late to class after break without a pass.",
      actionTaken: "Verbal warning given.",
      status: "CLOSED",
    }
  });

  console.log("✓ Seeded J.8 Chunk 8: Extra Learner Journey data for Atieno.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
