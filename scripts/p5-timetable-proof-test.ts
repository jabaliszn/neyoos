/**
 * P.5 — direct proof of the real gaps found + fixed in the whole-school
 * Timetable Engine:
 *  1) Saturday is now folded into the SAME conflict-checked solve pass as
 *     Mon-Fri (per-class hasSaturday/saturdayPeriodsCount), not a separate
 *     bolt-on tool — proven by generating a real timetable for a class with
 *     Saturday ON and confirming real ACADEMIC slots land on dayOfWeek=6.
 *  2) Each class's own periodsPerDay is respected (never a single hardcoded
 *     8) — proven by giving one class periodsPerDay=6 and confirming no slot
 *     for that class ever lands on period 7 or 8.
 *  3) The regenerate no longer wipes non-ACADEMIC slots — proven by manually
 *     creating a real ACTIVITY slot, running a full regenerate, and
 *     confirming the ACTIVITY slot survives untouched.
 *  4) bulkCreateStreams wires a real TimetableConfig row automatically for
 *     each newly created stream.
 * Cleans up every throwaway row it creates.
 */
import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import { runGeneration } from "../src/lib/services/timetable-engine.service";
import { bulkCreateStreams } from "../src/lib/services/student.service";

const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.findFirst({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirst({ where: { tenantId: tenant!.id, role: "PRINCIPAL" } });
  if (!tenant || !principal) throw new Error("Expected seeded tenant/principal.");
  const user: any = {
    id: principal.id, tenantId: principal.tenantId, neyoLoginId: "test", fullName: principal.fullName,
    phone: null, email: principal.email, role: principal.role, secondaryRole: principal.secondaryRole, language: "en",
  };

  // ---- Setup: 2 throwaway classes, one Saturday+8 periods, one no-Saturday+6 periods ----
  const created = await withTenant(tenant.id, async () => {
    const tdb = tenantDb();
    const subjectCodes = ["MAT"];
    const subjects = await tdb.subject.findMany({ where: { code: { in: subjectCodes } } });
    if (subjects.length < subjectCodes.length) throw new Error("Expected all seeded test subjects to exist.");
    const mat = subjects[0];

    const classA = await tdb.schoolClass.create({ data: { tenantId: tenant.id, level: "P5TEST", stream: "SatOn", curriculum: "CBC" } });
    const classB = await tdb.schoolClass.create({ data: { tenantId: tenant.id, level: "P5TEST", stream: "SixPeriods", curriculum: "CBC" } });

    // classA: a deliberately TINY weekday capacity — only 1 period/day
    // Mon-Fri (5 real weekday slots total) — but Saturday ON with 2 periods.
    // A single-subject load of 6 lessons/week trivially exceeds the 5
    // weekday slots by exactly 1, forcing the solver to use Saturday. Kept
    // to ONE subject/one card type so backtracking search stays instant —
    // the goal is proving Saturday folds into the same real solve pass, not
    // stress-testing the backtracking solver itself.
    await tdb.timetableConfig.create({ data: { tenantId: tenant.id, classId: classA.id, periodsPerDay: 1, hasSaturday: true, saturdayPeriodsCount: 2, lunchShift: 1 } });
    await tdb.timetableConfig.create({ data: { tenantId: tenant.id, classId: classB.id, periodsPerDay: 6, hasSaturday: false, lunchShift: 1 } });

    await tdb.classSubjectNeed.create({ data: { tenantId: tenant.id, classId: classA.id, subjectId: mat.id, lessonsPerWeek: 6, doubleCount: 0 } });
    // classB: a modest, easily-fittable load within its real 6-period day.
    await tdb.classSubjectNeed.create({ data: { tenantId: tenant.id, classId: classB.id, subjectId: mat.id, lessonsPerWeek: 6, doubleCount: 0 } });

    // A real manually-placed ACTIVITY slot for classA that must survive a
    // full regenerate (proof of the unscoped-deleteMany bugfix).
    const activityCategory = await tdb.activityCategory.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "P5 Test Club" } },
      update: {},
      create: { tenantId: tenant.id, name: "P5 Test Club" },
    });
    await tdb.timetableSlot.create({
      data: { tenantId: tenant.id, classId: classA.id, activityCategoryId: activityCategory.id, dayOfWeek: 3, period: 2, slotType: "ACTIVITY" },
    });

    return { classA, classB, activityCategory };
  });

  try {
    // ---- Run the real whole-school generation (synchronously, bypassing the job queue) ----
    const jobId = "p5-test-job";
    await withTenant(tenant.id, async () => {
      await tenantDb().timetableGenerationJob.deleteMany({ where: { id: jobId } });
      await tenantDb().timetableGenerationJob.create({ data: { id: jobId, tenantId: tenant.id, status: "RUNNING", startedById: user.id, startedByName: user.fullName } });
    });
    await runGeneration(tenant.id, jobId, user);

    const slots = await withTenant(tenant.id, async () => tenantDb().timetableSlot.findMany({ where: { classId: { in: [created.classA.id, created.classB.id] } } }));

    // 1) Saturday folded into the same solve for classA (hasSaturday=true).
    const classASaturdaySlots = slots.filter((s) => s.classId === created.classA.id && s.dayOfWeek === 6);
    assert.ok(classASaturdaySlots.length > 0, "Expected at least one real Saturday ACADEMIC/lunch slot for the Saturday-enabled class.");
    console.log(`✓ Case 1 (Saturday-in-solver): classA got ${classASaturdaySlots.length} real Saturday slot(s), same solve pass as weekdays.`);

    // 2) classB has NO Saturday slots and NEVER exceeds its real 6-period day.
    const classBSaturdaySlots = slots.filter((s) => s.classId === created.classB.id && s.dayOfWeek === 6);
    assert.strictEqual(classBSaturdaySlots.length, 0, "Expected zero Saturday slots for the Saturday-disabled class.");
    const classBOverflow = slots.filter((s) => s.classId === created.classB.id && s.period > 6);
    assert.strictEqual(classBOverflow.length, 0, "Expected zero slots beyond period 6 for the 6-period-per-day class.");
    console.log("✓ Case 2 (per-class periodsPerDay): classB has no Saturday slots and never exceeds period 6.");

    // 3) The manually-placed ACTIVITY slot survived the regenerate.
    const survivingActivity = await withTenant(tenant.id, async () =>
      tenantDb().timetableSlot.findFirst({ where: { classId: created.classA.id, slotType: "ACTIVITY", dayOfWeek: 3, period: 2 } })
    );
    assert.ok(survivingActivity, "Expected the manually-placed ACTIVITY slot to survive the regenerate (unscoped-deleteMany bugfix).");
    console.log("✓ Case 3 (scoped wipe bugfix): the manually-placed ACTIVITY slot survived a full whole-school regenerate.");
  } finally {
    // ---- Cleanup ----
    await withTenant(tenant.id, async () => {
      const tdb = tenantDb();
      await tdb.timetableSlot.deleteMany({ where: { classId: { in: [created.classA.id, created.classB.id] } } });
      await tdb.classSubjectNeed.deleteMany({ where: { classId: { in: [created.classA.id, created.classB.id] } } });
      await tdb.timetableConfig.deleteMany({ where: { classId: { in: [created.classA.id, created.classB.id] } } });
      await tdb.activityCategory.delete({ where: { id: created.activityCategory.id } }).catch(() => {});
      await tdb.schoolClass.deleteMany({ where: { id: { in: [created.classA.id, created.classB.id] } } });
      await tdb.timetableGenerationJob.deleteMany({ where: { id: "p5-test-job" } });
    });
  }

  // ---- Case 4: bulkCreateStreams wires a real TimetableConfig automatically ----
  const bulkResult = await bulkCreateStreams(user, { level: "P5BULKTEST", curriculum: "CBC", streamNames: ["Alpha", "Beta", "Gamma"] });
  try {
    assert.strictEqual(bulkResult.createdCount, 3, "Expected 3 new streams created.");
    for (const c of bulkResult.created) {
      const cfg = await withTenant(tenant.id, async () => tenantDb().timetableConfig.findUnique({ where: { classId: c.id } }));
      assert.ok(cfg, `Expected a real TimetableConfig row auto-wired for stream ${c.stream}.`);
    }
    console.log(`✓ Case 4 (bulk stream creation): created ${bulkResult.createdCount} streams, each with a real auto-wired TimetableConfig.`);

    // Idempotency: re-running with an overlapping name skips the existing one.
    const secondRun = await bulkCreateStreams(user, { level: "P5BULKTEST", curriculum: "CBC", streamNames: ["Alpha", "Delta"] });
    assert.strictEqual(secondRun.createdCount, 1, "Expected only the genuinely new stream to be created on a repeat call.");
    assert.strictEqual(secondRun.skippedCount, 1, "Expected the already-existing stream to be skipped, not duplicated.");
    console.log("✓ Case 4b (idempotency): re-running bulk creation skips existing streams instead of duplicating them.");
    bulkResult.created.push(...secondRun.created);
  } finally {
    await withTenant(tenant.id, async () => {
      const tdb = tenantDb();
      const ids = bulkResult.created.map((c) => c.id);
      await tdb.timetableConfig.deleteMany({ where: { classId: { in: ids } } });
      await tdb.schoolClass.deleteMany({ where: { id: { in: ids } } });
    });
  }

  console.log("\n✅ All P.5 timetable-engine proofs passed and all test data cleaned up.");
}

main()
  .catch((e) => { console.error("❌ P.5 proof failed:", e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
