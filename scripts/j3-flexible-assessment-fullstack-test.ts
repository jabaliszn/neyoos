/**
 * J.3 — Flexible Assessment Engine — full-stack proof.
 *
 * Proves, against the REAL repo (validation + Prisma service + DB + flags), that:
 *  1. A principal can seed default assessment types.
 *  2. A principal can create an assessment PLAN scoped to a real class.
 *  3. A principal can SCORE a real learner against the plan (marks → percentage).
 *  4. Parent/student visibility RESPECTS release status: BEFORE release a parent
 *     sees nothing; AFTER moderate + release (visibleToParents) the parent sees it.
 *  5. Release is blocked if no learner is scored (STATE guard).
 *  6. Part-J toggle: J.3 OFF blocks the school surface; ON restores. Default ON.
 *
 * Cleans up everything it creates; leaves the seed as found.
 */
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import {
  ensureDefaultAssessmentTypes,
  createAssessmentPlan,
  scoreAssessmentRecord,
  moderateAssessmentRecord,
  releaseAssessmentPlan,
  assessmentBoard,
  AssessmentError,
} from "../src/lib/services/assessment.service";
import { assertJFeatureEnabled } from "../src/lib/services/platform-flags.service";
import { setFlag, FlagError } from "../src/lib/services/platform-flags.service";
import { jFeatureKey } from "../src/lib/core/j-features";

function sessionFrom(u: any) {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as any, secondaryRole: u.secondaryRole as any, language: u.language as any,
  };
}

let pass = 0;
function check(name: string, cond: boolean) {
  assert.ok(cond, `FAILED: ${name}`);
  console.log(`  ✓ ${name}`);
  pass++;
}

async function main() {
  const ops = sessionFrom(await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } }));
  const principal = sessionFrom(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const tenantId = principal.tenantId;

  // a real class + a real ACTIVE learner in it, and that learner's parent
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId, classId: cls.id, status: "ACTIVE" } });
  const link = await db.studentGuardian.findFirst({ where: { student: { id: student.id } }, include: { guardian: true } });
  const parentUser = link ? await db.user.findFirst({ where: { tenantId, role: "PARENT" } }) : null;

  // clean leftovers
  await db.platformFlag.deleteMany({ where: { moduleKey: jFeatureKey("J.3") } });
  await db.assessmentPlan.deleteMany({ where: { tenantId, title: { startsWith: "J3 Test" } } });

  let createdPlanId: string | null = null;
  try {
    console.log("\n[1] Seed default assessment types");
    const seeded = await ensureDefaultAssessmentTypes(principal);
    const types = await db.assessmentType.findMany({ where: { tenantId } });
    check("default assessment types exist after seeding", types.length > 0);
    const type = types[0];

    console.log("\n[2] Create a class-scoped assessment plan");
    const plan: any = await createAssessmentPlan(principal, {
      assessmentTypeId: type.id,
      classId: cls.id,
      year: 2026,
      term: 1,
      title: "J3 Test Term Project",
      weight: 20,
      maxMarks: 50,
      status: "ACTIVE",
      visibleToParents: false,
    } as any);
    createdPlanId = plan.id;
    check("assessment plan created", !!plan.id);

    console.log("\n[3] Score a real learner");
    const rec: any = await scoreAssessmentRecord(principal, {
      planId: plan.id,
      studentId: student.id,
      scoreMarks: 40,
      status: "SCORED",
    } as any);
    check("record scored", !!rec.id);
    check("percentage auto-computed (40/50 = 80%)", rec.scorePct === 80);

    console.log("\n[4] Parent visibility respects release status");
    if (parentUser) {
      const parent = sessionFrom(parentUser);
      const beforeBoard: any = await assessmentBoard(parent);
      const seesBefore = beforeBoard.plans.some((p: any) => p.id === plan.id);
      check("parent does NOT see the plan before release", seesBefore === false);

      // moderate then release (visible to parents)
      await moderateAssessmentRecord(principal, { recordId: rec.id, status: "MODERATED" } as any);
      await releaseAssessmentPlan(principal, { planId: plan.id, visibleToParents: true } as any);

      const afterBoard: any = await assessmentBoard(parent);
      const seesAfter = afterBoard.plans.some((p: any) => p.id === plan.id);
      check("parent DOES see the plan after release (visibleToParents)", seesAfter === true);
    } else {
      // No parent user in seed — still prove release works + staff sees released plan.
      await moderateAssessmentRecord(principal, { recordId: rec.id, status: "MODERATED" } as any);
      await releaseAssessmentPlan(principal, { planId: plan.id, visibleToParents: true } as any);
      const released = await db.assessmentPlan.findUniqueOrThrow({ where: { id: plan.id } });
      check("plan released (no parent user in seed to test visibility)", released.status === "RELEASED");
    }

    console.log("\n[5] Release is blocked with zero scored learners");
    const emptyPlan: any = await createAssessmentPlan(principal, {
      assessmentTypeId: type.id,
      classId: cls.id,
      year: 2026,
      term: 1,
      title: "J3 Test Empty Plan",
      weight: 5,
      status: "ACTIVE",
    } as any);
    let blocked = false;
    try {
      await releaseAssessmentPlan(principal, { planId: emptyPlan.id, visibleToParents: true } as any);
    } catch (e) {
      blocked = e instanceof AssessmentError && (e as AssessmentError).code === "STATE";
    }
    check("releasing a plan with no scores is blocked (STATE guard)", blocked);
    await db.assessmentPlan.delete({ where: { id: emptyPlan.id } });

    console.log("\n[6] Part-J toggle: J.3 default ON; OFF blocks; ON restores");
    let okWhileOn = true;
    try { await assertJFeatureEnabled("J.3"); } catch { okWhileOn = false; }
    check("J.3 defaults ON (no flag row)", okWhileOn);

    await setFlag(ops, jFeatureKey("J.3"), true, "j3-test pause");
    let blockedOff = false;
    try { await assertJFeatureEnabled("J.3"); } catch (e) { blockedOff = e instanceof FlagError && (e as FlagError).code === "FORBIDDEN"; }
    check("J.3 OFF blocks the assessment surface", blockedOff);

    await setFlag(ops, jFeatureKey("J.3"), false, "j3-test release");
    let restored = true;
    try { await assertJFeatureEnabled("J.3"); } catch { restored = false; }
    check("switching J.3 back ON restores the surface", restored);

    console.log(`\n✅ J.3 full-stack test: ${pass} checks passed, 0 failed.`);
  } finally {
    // cleanup
    if (createdPlanId) {
      await db.assessmentRecord.deleteMany({ where: { planId: createdPlanId } });
    }
    await db.assessmentRecord.deleteMany({ where: { plan: { tenantId, title: { startsWith: "J3 Test" } } } });
    await db.assessmentPlan.deleteMany({ where: { tenantId, title: { startsWith: "J3 Test" } } });
    await db.platformFlag.deleteMany({ where: { moduleKey: jFeatureKey("J.3") } });
    await db.$disconnect();
  }
}

main().catch(async (e) => {
  console.error("\n❌ J.3 full-stack test FAILED:", e);
  await db.$disconnect();
  process.exit(1);
});
