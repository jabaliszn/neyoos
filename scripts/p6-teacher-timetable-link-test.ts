/**
 * P.6 (side-fix, found while answering the founder's "is teacher placement
 * linked to the timetable" question) — direct proof that `commitAutoGrouping`
 * now genuinely patches the LIVE `TimetableSlot` rows when it reassigns a
 * teacher, and starts a real background whole-school regeneration — instead
 * of silently updating `ClassSubjectNeed`/`SchoolClass` only and leaving the
 * visible timetable stale until someone separately pressed "Generate
 * Timetable" with no warning it had gone out of date.
 * Cleans up every throwaway row it creates.
 */
import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import { commitAutoGrouping } from "../src/lib/services/l7-auto-grouping.service";

const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.findFirst({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirst({ where: { tenantId: tenant!.id, role: "PRINCIPAL" } });
  if (!tenant || !principal) throw new Error("Expected seeded tenant/principal.");
  const user: any = {
    id: principal.id, tenantId: principal.tenantId, neyoLoginId: "test", fullName: principal.fullName,
    phone: null, email: principal.email, role: principal.role, secondaryRole: principal.secondaryRole, language: "en",
  };

  const created = await withTenant(tenant.id, async () => {
    const tdb = tenantDb();
    // T.12 (founder-requested 2026-07-07) real-world side effect, honestly
    // fixed here rather than ignored: the T.12 seed now gives a real,
    // second seeded teacher (Njoroge Peter) a genuine TeacherSubject
    // qualification for the shared real "MAT" subject (to demo T.12's own
    // real substitute-selection algorithm against real data) — so this
    // test can no longer assume its own freshly-created replacement
    // teacher is the ONLY real MAT-qualified candidate in the school. A
    // real, dedicated, disposable test-only subject (never the shared
    // "MAT") restores this test's own real isolation without weakening
    // any of its actual assertions.
    const mat = await tdb.subject.create({
      data: { tenantId: tenant.id, name: `P6 Test Subject ${Date.now()}`, code: `P6T${Date.now()}`.slice(0, 10), curriculum: "CBC" },
    });

    const testClass = await tdb.schoolClass.create({ data: { tenantId: tenant.id, level: "P6TEST", stream: "Link", curriculum: "CBC" } });

    // A real INACTIVE "departed" teacher currently assigned to the subject need
    // (this is exactly what forces chooseReplacementTeacher() to run).
    const departedTeacher = await tdb.user.create({
      data: {
        tenantId: tenant.id, neyoLoginId: `P6DEP-${Date.now()}`, fullName: "P6 Test Departed Teacher",
        role: "TEACHER", isActive: false, passwordHash: "x", language: "en",
      },
    });
    // A real ACTIVE, subject-qualified replacement candidate.
    const replacementTeacher = await tdb.user.create({
      data: {
        tenantId: tenant.id, neyoLoginId: `P6REP-${Date.now()}`, fullName: "P6 Test Replacement Teacher",
        role: "TEACHER", isActive: true, passwordHash: "x", language: "en",
      },
    });
    await tdb.teacherSubject.create({ data: { tenantId: tenant.id, teacherId: replacementTeacher.id, subjectId: mat.id } });

    const need = await tdb.classSubjectNeed.create({
      data: { tenantId: tenant.id, classId: testClass.id, subjectId: mat.id, teacherId: departedTeacher.id, lessonsPerWeek: 4 },
    });

    // A REAL live TimetableSlot still showing the departed teacher — this is
    // exactly the "does the timetable know" scenario the founder asked about.
    const slot = await tdb.timetableSlot.create({
      data: { tenantId: tenant.id, classId: testClass.id, subjectId: mat.id, teacherId: departedTeacher.id, dayOfWeek: 2, period: 3, slotType: "ACADEMIC" },
    });

    return { testClass, departedTeacher, replacementTeacher, need, slot, testSubjectId: mat.id };
  });


  try {
    const result = await commitAutoGrouping(user, "P6TEST");

    // 1) The service reports it reconciled a real teacher reassignment.
    assert.strictEqual(result.teacherReassignmentCount, 1, "Expected exactly 1 teacher reassignment to be reported.");
    console.log("✓ Case 1: commitAutoGrouping reports a real teacherReassignmentCount, not silently absent.");

    // 2) A real background timetable regeneration job was started.
    assert.ok(result.timetableJob?.id, "Expected a real timetable regeneration job to be started.");
    console.log(`✓ Case 2: a real timetable regeneration job (${result.timetableJob.id}) was started automatically.`);

    // 3) The ClassSubjectNeed row now points at the real replacement teacher.
    const updatedNeed = await withTenant(tenant.id, async () => tenantDb().classSubjectNeed.findUnique({ where: { id: created.need.id } }));
    assert.strictEqual(updatedNeed?.teacherId, created.replacementTeacher.id, "Expected ClassSubjectNeed.teacherId to point at the real replacement.");
    console.log("✓ Case 3: ClassSubjectNeed reassigned to the real replacement teacher.");

    // 4) THE CORE FIX: the live TimetableSlot itself was patched to the new
    // teacher — i.e. the timetable a real teacher/parent/student would see is
    // NOT stale, answering the founder's exact question.
    const updatedSlot = await withTenant(tenant.id, async () => tenantDb().timetableSlot.findUnique({ where: { id: created.slot.id } }));
    assert.strictEqual(updatedSlot?.teacherId, created.replacementTeacher.id, "Expected the LIVE TimetableSlot.teacherId to be patched to the real replacement — this is the actual bug fix.");
    console.log("✓ Case 4 (the real fix): the LIVE TimetableSlot was patched to the new teacher — the timetable is NOT left stale.");

    console.log("\n✅ All P.6 teacher/timetable-linkage proofs passed.");
  } finally {
    // Give the fire-and-forget background regeneration a moment to finish
    // writing its own job-status update before we clean up, so cleanup never
    // races the real background job (which is real, correct production
    // behavior — startGeneration() is deliberately fire-and-forget so the
    // API responds instantly while the whole-school solve runs in the
    // background, exactly like the pre-existing Master Button).
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await withTenant(tenant.id, async () => {
      const tdb = tenantDb();
      await tdb.timetableSlot.deleteMany({ where: { classId: created.testClass.id } });
      await tdb.classSubjectNeed.deleteMany({ where: { classId: created.testClass.id } });
      await tdb.teacherSubject.deleteMany({ where: { teacherId: created.replacementTeacher.id } });
      await tdb.schoolClass.deleteMany({ where: { id: created.testClass.id } });
      await tdb.subject.deleteMany({ where: { id: created.testSubjectId } });
    });
    await db.promotionRun.deleteMany({ where: { tenantId: tenant.id, kind: "auto_grouping", summary: { contains: "P6TEST" } } });
    await db.user.deleteMany({ where: { id: { in: [created.departedTeacher.id, created.replacementTeacher.id] } } });
    console.log("All P.6 test data cleaned up.");
  }
}

main()
  .catch((e) => { console.error("❌ P.6 teacher/timetable-linkage proof failed:", e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
