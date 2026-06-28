import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const atieno = await db.student.findFirst({ where: { firstName: "Atieno" } });
  const teacher = await db.user.findFirst({ where: { email: "p.njoroge@karibuhigh.ac.ke" } });
  const langGroup = await db.competencyGroup.findFirst({ where: { tenantId: khTenant.id, code: "LANG" } });
  const langComp = await db.competency.findFirst({ where: { tenantId: khTenant.id, groupId: langGroup?.id } });
  
  if (!atieno || !teacher || !langComp) throw new Error("Seed users/competencies not found");

  for (let i = 0; i < 12; i++) {
    await db.competencyEvidence.create({
      data: {
        tenantId: khTenant.id,
        studentId: atieno.id,
        competencyId: langComp.id,
        level: 1, 
        narrative: "Struggling with reading fluency.",
        evidenceDate: "2026-06-25",
        recordedById: teacher.id,
        recordedByName: teacher.fullName,
        approved: true,
      }
    });
  }

  for (let i = 0; i < 7; i++) {
    const d = 10 + i;
    await db.attendanceRecord.upsert({
      where: { tenantId_studentId_date: { tenantId: khTenant.id, studentId: atieno.id, date: "2026-06-" + d } },
      update: {},
      create: {
        tenantId: khTenant.id,
        studentId: atieno.id,
        date: "2026-06-" + d,
        status: "A",
        markedById: teacher.id,
        markedByName: teacher.fullName,
      }
    });
  }

  console.log("✓ J.16 DB Seeded Intervention Triggers for Advanced Analytics.");
}

main().catch(console.error).finally(() => db.$disconnect());
