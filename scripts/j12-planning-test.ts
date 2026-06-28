import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const eng = await db.subject.findFirst({ where: { tenantId: khTenant.id, code: "ENG" } });
  const teacher = await db.user.findFirst({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  const form2E = await db.schoolClass.findFirst({ where: { tenantId: khTenant.id, level: "Form 2", stream: "East" } });
  
  if (!eng || !teacher || !form2E) throw new Error("Required seed data not found");

  const compGroup = await db.competencyGroup.findFirst({ where: { tenantId: khTenant.id, code: "LANG" } });
  const comp = await db.competency.findFirst({ where: { tenantId: khTenant.id, groupId: compGroup?.id } });
  const strand = await db.cbcStrand.findFirst({ where: { tenantId: khTenant.id, subjectId: eng.id } });

  const plan = await db.lessonPlan.create({
    data: {
      tenantId: khTenant.id,
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      subjectId: eng.id,
      classId: form2E.id,
      date: "2026-06-29",
      topic: "Grammar & Advanced Punctuation",
      objectives: "Students should be able to identify and use semicolons correctly.",
      activities: "Group reading and punctuation exercises.",
      notes: "Prepared handout attached.",
      status: "PLANNED",
      strandId: strand?.id || null,
      competencyId: comp?.id || null,
      resources: {
        create: [
          { tenantId: khTenant.id, fileUrl: "https://example.com/grammar-handout.pdf", fileName: "Grammar Handout" }
        ]
      }
    }
  });

  console.log("✓ J.12 DB Seeded connected Lesson Plan for F. Chebet.", plan.id);
}

main().catch(console.error).finally(() => db.$disconnect());
