import { db } from "@/lib/db";
import { createDemoSchool } from "@/lib/services/demo.service";
import { getAppearanceSettings } from "@/lib/services/platform-appearance.service";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function deleteDemoTenant(tenantId: string) {
  const users = await db.user.findMany({ where: { tenantId }, select: { id: true } });
  await db.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
  await db.user.deleteMany({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
}

async function main() {
  console.log("I.76 demo full parity test");
  const demo = await createDemoSchool({ userAgent: "i76-test", ipAddress: "127.0.0.1", deviceId: "i76-device" });
  try {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: demo.tenantId } });
    assert(tenant.isDemo && Boolean(tenant.demoExpiresAt), "demo tenant is sandboxed and expiring");

    const modules = await db.tenantModule.findMany({ where: { tenantId: demo.tenantId, enabled: true }, select: { moduleKey: true } });
    const moduleKeys = new Set(modules.map((m) => m.moduleKey));
    for (const key of ["hostel", "transport", "library", "lms", "inventory", "cafeteria"]) assert(moduleKeys.has(key), `demo has ${key} module enabled`);

    const staff = await db.user.findMany({ where: { tenantId: demo.tenantId } });
    assert(staff.some((u) => u.role === "CLASS_TEACHER") && staff.some((u) => u.role === "BURSAR"), "demo includes real staff roles beyond the owner");

    const subjects = await db.subject.count({ where: { tenantId: demo.tenantId } });
    assert(subjects >= 4, "demo includes real subjects for timetable/exams/syllabus");

    const timetable = await db.timetableSlot.findMany({ where: { tenantId: demo.tenantId } });
    assert(timetable.length >= 6 && timetable.some((s) => s.venue === "Science Lab"), "demo timetable has real lessons with venues for I.73 printing");
    const config = await db.timetableConfig.count({ where: { tenantId: demo.tenantId } });
    assert(config >= 2, "demo timetable has break/lunch timing config");

    const syllabus = await db.syllabusTopic.findMany({ where: { tenantId: demo.tenantId } });
    assert(syllabus.length >= 4 && syllabus.some((s) => s.status === "IN_PROGRESS"), "demo includes syllabus coverage topics");

    const exam = await db.examTimetableSlot.findFirst({ where: { tenantId: demo.tenantId, venue: "Main Hall" } });
    assert(Boolean(exam), "demo includes dedicated exam timetable slots");

    const queue = await db.cafeteriaQueueEntry.findMany({ where: { tenantId: demo.tenantId, session: "LUNCH" } });
    assert(queue.length >= 3 && queue.some((q) => q.status === "SERVED"), "demo includes cafeteria meal queue data");

    const studentWithSchoolNo = await db.student.findFirst({ where: { tenantId: demo.tenantId, legacyAdmissionNo: { not: null } } });
    assert(Boolean(studentWithSchoolNo), "demo includes school admission numbers plus NEYO IDs");

    const appearance = await getAppearanceSettings();
    assert(typeof appearance.liquidEnabled === "boolean" && ["1", "2", "3"].includes(appearance.liquidLevel), "demo clients can read current Liquid Glass company settings");
  } finally {
    await deleteDemoTenant(demo.tenantId);
  }
  console.log("\n✅ I.76 demo full parity test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
