import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const { autoAssignTeachersToClasses } = await import("../src/lib/services/timetable-solver.service");

  const su = { id: "SYSTEM", tenantId: khTenant.id, role: "SUPER_ADMIN", fullName: "System" } as any;

  // Let's create an unassigned need
  const math = await db.subject.findFirst({ where: { tenantId: khTenant.id, code: "MAT" } });
  const form1 = await db.schoolClass.findFirst({ where: { tenantId: khTenant.id, level: "Form 1" } });
  
  if (math && form1) {
    await db.classSubjectNeed.upsert({
      where: { tenantId_classId_subjectId: { tenantId: khTenant.id, classId: form1.id, subjectId: math.id } },
      create: { tenantId: khTenant.id, classId: form1.id, subjectId: math.id, lessonsPerWeek: 5, teacherId: null },
      update: { teacherId: null }
    });
  }

  const result = await autoAssignTeachersToClasses(su);
  console.log("✓ L.3 Auto-Matching complete. Assignments made:", result.assignedCount);
}

main().catch(console.error).finally(() => db.$disconnect());
