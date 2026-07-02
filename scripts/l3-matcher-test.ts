import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";

/**
 * L.3 — Automatic Teacher-Class Matching (repaired 2026-07-01).
 * The old version of this script asserted nothing and just printed
 * `assignedCount`, which could silently read 0 forever without anyone
 * noticing a real regression. This version sets up a clean, deterministic
 * scenario and asserts the matcher actually assigns the right teacher.
 */
async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });

  await withTenant(tenant.id, async () => {
    const { autoAssignTeachersToClasses, saveTeacherSubjects } = await import(
      "../src/lib/services/timetable-solver.service"
    );

    const su = { id: "SYSTEM", tenantId: tenant.id, role: "SUPER_ADMIN", fullName: "System" } as any;

    const chebet = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } });
    const math = await db.subject.findFirstOrThrow({ where: { tenantId: tenant.id, code: "MAT" } });
    const form1 = await db.schoolClass.findFirstOrThrow({ where: { tenantId: tenant.id, level: "Form 1" } });

    // Clean any leftover state from other test runs so this test is deterministic.
    await db.classSubjectNeed.deleteMany({ where: { tenantId: tenant.id, classId: form1.id, subjectId: math.id } });
    await db.teacherSubject.deleteMany({ where: { tenantId: tenant.id, teacherId: chebet.id, subjectId: math.id } });

    // 1) No eligible teacher yet -> matcher must find nothing (never invent an assignment).
    await db.classSubjectNeed.create({
      data: { tenantId: tenant.id, classId: form1.id, subjectId: math.id, teacherId: null, lessonsPerWeek: 5 },
    });
    const noTeacherYet = await autoAssignTeachersToClasses(su);
    assert.equal(noTeacherYet.assignedCount, 0, "matcher must not assign when nobody teaches the subject");

    // 2) Register Chebet as a strong Mathematics teacher, then re-run.
    await saveTeacherSubjects(su, chebet.id, [{ id: math.id, isStrong: true }]);
    const result = await autoAssignTeachersToClasses(su);
    assert.equal(result.success, true, "matcher should report success");
    assert.equal(result.assignedCount, 1, "matcher should assign exactly the one open need");

    const need = await db.classSubjectNeed.findFirstOrThrow({
      where: { tenantId: tenant.id, classId: form1.id, subjectId: math.id },
    });
    assert.equal(need.teacherId, chebet.id, "the open Mathematics need must now be assigned to Chebet");

    // 3) Idempotency: re-running with nothing left unassigned must do nothing (not double-assign).
    const rerun = await autoAssignTeachersToClasses(su);
    assert.equal(rerun.assignedCount, 0, "re-running with no open needs must assign nothing further");

    // Clean up so the seed stays tidy for the next script/run.
    await db.classSubjectNeed.deleteMany({ where: { tenantId: tenant.id, classId: form1.id, subjectId: math.id } });
    await db.teacherSubject.deleteMany({ where: { tenantId: tenant.id, teacherId: chebet.id, subjectId: math.id } });

    console.log("✓ L.3 Auto-Matching genuinely verified: 0 assignments with no eligible teacher, 1 correct assignment once a teacher is registered, 0 on idempotent re-run.");
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
