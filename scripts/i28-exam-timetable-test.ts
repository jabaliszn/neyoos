import { db } from "@/lib/db";
import { createExamTimetableSlot, deleteExamTimetableSlot, examTimetableBoard } from "@/lib/services/exam-timetable.service";
import { bulkSaturdaySchedule, fairSaturdaySchedule } from "@/lib/services/academics.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }
async function expectThrows(fn: () => Promise<unknown>, label: string) { try { await fn(); } catch { console.log(`  ✓ ${label}`); return; } throw new Error(`Expected failure: ${label}`); }

async function main() {
  console.log("I.28 exam timetable + Saturday rotation test");
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: principal.tenantId, archived: false } });
  const subject = await db.subject.findFirstOrThrow({ where: { tenantId: principal.tenantId, archived: false } });
  await db.examTimetableSlot.deleteMany({ where: { tenantId: principal.tenantId, examDate: "2099-11-11" } });

  const slot = await createExamTimetableSlot(principal, { classId: cls.id, subjectId: subject.id, examName: "End Term Test", examDate: "2099-11-11", startTime: "08:00", endTime: "09:30", venue: "Hall" });
  assert(slot.id && slot.examName === "End Term Test", "dedicated exam timetable slot is created separate from lesson timetable");
  await expectThrows(() => createExamTimetableSlot(principal, { classId: cls.id, subjectId: subject.id, examName: "Clashing Test", examDate: "2099-11-11", startTime: "09:00", endTime: "10:00" }), "exam timetable blocks class time clashes");

  const board = await examTimetableBoard(principal, { classId: cls.id });
  assert(board.slots.some((s) => s.id === slot.id && s.className), "exam timetable board lists the slot with class/subject labels");

  await deleteExamTimetableSlot(principal, slot.id);
  const sat = await bulkSaturdaySchedule(principal, { classIds: [cls.id], periodIds: [1], subjectId: subject.id, weekRotation: "WEEK_A" });
  assert(sat.createdCount === 1, "Saturday scheduler supports alternating Week A rotation");
  const created = await db.timetableSlot.findFirst({ where: { tenantId: principal.tenantId, classId: cls.id, dayOfWeek: 6, period: 1, subjectId: subject.id, weekRotation: "WEEK_A" } });
  assert(Boolean(created), "Saturday slot saved with rotation marker");
  if (created) await db.timetableSlot.delete({ where: { id: created.id } });

  const subjects = await db.subject.findMany({ where: { tenantId: principal.tenantId, archived: false }, take: 3 });
  const fair = await fairSaturdaySchedule(principal, {
    classIds: [cls.id],
    periodIds: [1, 2, 3],
    subjectIds: subjects.map((s) => s.id),
    mode: "REMEDIAL",
    rotationMode: "ALTERNATE",
  });
  assert(fair.createdCount === 3, "fair Saturday scheduler fills selected short-day periods");
  const fairSlots = await db.timetableSlot.findMany({ where: { tenantId: principal.tenantId, classId: cls.id, dayOfWeek: 6, period: { in: [1, 2, 3] } } });
  assert(new Set(fairSlots.map((s) => s.subjectId)).size >= 2, "fair Saturday scheduler rotates different subjects");
  assert(fairSlots.some((s) => s.weekRotation === "WEEK_A") && fairSlots.some((s) => s.weekRotation === "WEEK_B"), "fair Saturday scheduler alternates Week A and Week B");
  await db.timetableSlot.deleteMany({ where: { id: { in: fairSlots.map((s) => s.id) } } });

  console.log("\n✅ I.28 exam timetable + Saturday rotation test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
