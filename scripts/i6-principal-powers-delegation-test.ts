import { db } from "../src/lib/db";
import { effectivePermissionsForUser, type SessionUser } from "../src/lib/core/session";
import { attendanceOverview, getRegister, markRegister } from "../src/lib/services/attendance.service";
import { createDelegationTask, delegationBoard, completeDelegationTask } from "../src/lib/services/delegation.service";
import { readFileSync } from "node:fs";
import type { Role } from "../src/lib/core/roles";

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}
async function expectThrows(name: string, fn: () => Promise<unknown>, code?: string) {
  try {
    await fn();
    check(name, false, "expected an error");
  } catch (e: any) {
    check(name, code ? e?.code === code : true, `blocked with ${e?.code ?? e?.name ?? "error"}`);
  }
}
function asUser(u: any): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    neyoLoginId: u.neyoLoginId,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role as Role,
    secondaryRole: (u.secondaryRole ?? null) as Role | null,
    language: u.language ?? "en",
  };
}

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!tenant) throw new Error("Karibu tenant missing. Run npm run db:seed first.");

  const [principalRow, teacherRow, deputyRow] = await Promise.all([
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "deputy@karibuhigh.ac.ke" } }),
  ]);
  const principal = asUser(principalRow);
  const teacher = asUser(teacherRow);
  const deputy = asUser(deputyRow);

  const targetClass = await db.schoolClass.findFirstOrThrow({
    where: { tenantId: tenant.id, archived: false, students: { some: { status: "ACTIVE" } } },
    include: { students: { where: { status: "ACTIVE" }, take: 2, select: { id: true } } },
  });
  const originalClassTeacherId = targetClass.classTeacherId;
  const testDate = "2026-06-22";
  const createdTaskIds: string[] = [];

  try {
    const principalPerms = await effectivePermissionsForUser(principal);
    check("Principal can view attendance by default", principalPerms.includes("attendance.view"));

    const overview = await attendanceOverview(principal, testDate);
    check("Principal read-only attendance overview returns classes", overview.classes.length > 0);
    const register = await getRegister(principal, targetClass.id, testDate);
    check("Principal can open any class register for viewing", register.students.length > 0);

    const source = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    check("Dashboard does not show Mark attendance CTA to master role unless class teacher", source.includes('(!isMasterAttendanceUser || stats.ownClassCount > 0) ? "Mark today&apos;s attendance" : "View attendance"'));

    const marks = targetClass.students.map((s) => ({ studentId: s.id, status: "P" as const }));
    await expectThrows(
      "Principal cannot mark another class without Master Override",
      () => markRegister(principal, { classId: targetClass.id, date: testDate, marks, notifyAbsent: false, masterOverride: false }),
      "FORBIDDEN"
    );

    const override = await markRegister(principal, { classId: targetClass.id, date: testDate, marks, notifyAbsent: false, masterOverride: true });
    check("Principal can mark via Master Override", override.saved === marks.length);
    const overrideAudit = await db.auditLog.findFirst({ where: { tenantId: tenant.id, action: "attendance.master_override", entityId: targetClass.id }, orderBy: { createdAt: "desc" } });
    check("Master Override audit is recorded", !!overrideAudit?.metadata?.includes('"masterOverride":true'));

    await db.attendanceRecord.deleteMany({ where: { tenantId: tenant.id, classId: targetClass.id, date: testDate } });
    await db.schoolClass.update({ where: { id: targetClass.id }, data: { classTeacherId: principal.id } });
    const ownClassMark = await markRegister(principal, { classId: targetClass.id, date: testDate, marks, notifyAbsent: false, masterOverride: false });
    check("Principal can mark attendance without override when they are the class teacher", ownClassMark.saved === marks.length);

    const board = await delegationBoard(principal);
    check("Principal delegation board can assign and lists teachers", board.canAssign && board.teachers.some((t) => t.id === teacher.id));
    await expectThrows(
      "Deputy cannot assign Principal-only delegation task",
      () => createDelegationTask(deputy, { title: "Check Form 2 books", assignedToId: teacher.id, category: "GENERAL" }),
      "FORBIDDEN"
    );
    const task = await createDelegationTask(principal, {
      title: "Confirm Form 2 East consent slips",
      details: "Please confirm the consent slips are complete before Friday.",
      category: "DUTY",
      assignedToId: teacher.id,
      dueDate: testDate,
    });
    createdTaskIds.push(task.id);
    check("Principal assigns a real non-sensitive task to teacher", !!task.id && task.assignedToId === teacher.id);
    const teacherBoard = await delegationBoard(teacher);
    check("Teacher sees assigned delegation task", teacherBoard.tasks.some((t) => t.id === task.id && t.isMine));
    const done = await completeDelegationTask(teacher, task.id);
    check("Teacher can mark delegated task done", done.status === "DONE" && !!done.completedAt);
    const notification = await db.notification.findFirst({ where: { tenantId: tenant.id, recipientId: teacher.id, category: "delegation", title: "Task assigned by school office" } });
    check("Delegation sends targeted in-app notification to teacher", !!notification);
    const audit = await db.auditLog.findFirst({ where: { tenantId: tenant.id, action: "delegation.task_assigned", entityId: task.id } });
    check("Delegation assignment audit is recorded", !!audit);

    const componentSource = readFileSync("src/components/dashboard/principal-delegation-card.tsx", "utf8");
    check("Dashboard has Principal delegation UI", componentSource.includes("Principal delegation") && componentSource.includes("Assign task"));
  } finally {
    await db.attendanceRecord.deleteMany({ where: { tenantId: tenant.id, classId: targetClass.id, date: testDate } });
    await db.schoolClass.update({ where: { id: targetClass.id }, data: { classTeacherId: originalClassTeacherId } });
    if (createdTaskIds.length) await db.principalDelegationTask.deleteMany({ where: { id: { in: createdTaskIds } } });
    await db.notification.deleteMany({ where: { tenantId: tenant.id, category: "delegation", OR: [{ recipientId: teacher.id }, { recipientId: principal.id }] } });
    await db.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nI.6 principal powers & delegation: ${results.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
