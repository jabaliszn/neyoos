import fs from "fs";
import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import {
  createLessonPlan,
  recordLessonObservation,
  listLessonObservations,
  addLessonResources,
  getLessonPlanningAnalytics,
} from "../src/lib/services/academics.service";

const db = new PrismaClient();

async function main() {
  // ---- static wiring ----
  assert(fs.existsSync("src/app/api/academics/lesson-plans/observations/route.ts"), "observations route must exist");
  assert(fs.existsSync("src/app/api/academics/lesson-plans/resources/route.ts"), "resources route must exist");
  const ui = fs.readFileSync("src/components/academics/academics-client.tsx", "utf8");
  assert(ui.includes("/api/cbc/strands?subjectId="), "PlanDialog must fetch strands");
  assert(ui.includes("/api/competencies"), "PlanDialog must fetch competencies");
  assert(ui.includes("/api/assessments"), "PlanDialog must fetch assessment plans");
  assert(ui.includes("ObservationDialog") && ui.includes("/api/academics/lesson-plans/observations"), "UI must record observations from plan");
  assert(ui.includes("ResourceDialog") && ui.includes("/api/academics/lesson-plans/resources"), "UI must attach resources to plan");
  assert(ui.includes("CoverageDialog") && ui.includes("/api/academics/lesson-plans/analytics"), "UI must show coverage/analytics");

  const principal = await db.user.findFirst({ where: { email: "principal@karibuhigh.ac.ke" } });
  const tenant = await db.tenant.findFirst({ where: { slug: "karibu-high" } });
  if (!principal || !tenant) throw new Error("Expected seeded principal + karibu-high tenant.");

  const user = {
    id: principal.id, tenantId: principal.tenantId, neyoLoginId: "test",
    fullName: principal.fullName, phone: null, email: principal.email,
    role: principal.role as any, secondaryRole: principal.secondaryRole as any, language: "en",
  };

  let createdPlanId = "";
  await withTenant(tenant.id, async () => {
    const student = await tenantDb().student.findFirst({ orderBy: { admissionNo: "asc" } });
    if (!student) throw new Error("need a seeded student");
    const subject = await tenantDb().subject.findFirst({ where: { archived: false } });
    if (!subject) throw new Error("need a seeded subject");
    const classId = student.classId || (await tenantDb().schoolClass.findFirst())?.id;
    if (!classId) throw new Error("need a class");

    // strand + competency + assessment plan to link
    const strand = await tenantDb().cbcStrand.upsert({
      where: { tenantId_subjectId_name: { tenantId: tenant.id, subjectId: subject.id, name: "J12 Test Strand" } },
      update: {}, create: { tenantId: tenant.id, subjectId: subject.id, name: "J12 Test Strand", learningOutcome: "Demonstrate the test outcome" },
    });
    const group = await tenantDb().competencyGroup.findFirst();
    const competency = await tenantDb().competency.create({
      data: { tenantId: tenant.id, groupId: group?.id ?? null, name: "J12 Test Competency", code: "J12-TEST-" + Date.now() },
    });
    const atype = await tenantDb().assessmentType.findFirst() || await tenantDb().assessmentType.create({ data: { tenantId: tenant.id, key: "OBSERVATION", name: "Observation", category: "OBSERVATION" } as any });
    const aplan = await tenantDb().assessmentPlan.create({
      data: { tenantId: tenant.id, assessmentTypeId: atype.id, subjectId: subject.id, classId, year: 2026, term: 2, title: "J12 Test Assessment", createdById: user.id, createdByName: user.fullName },
    });

    // ---- 1) create a plan linked to objective + competency + assessment + resource ----
    const plan = await createLessonPlan(user, {
      subjectId: subject.id, classId, date: "2026-06-29", topic: "J12 Test Lesson",
      strandId: strand.id, competencyId: competency.id, assessmentPlanId: aplan.id,
      resources: [{ fileUrl: "https://example.com/worksheet.pdf", fileName: "Worksheet" }],
    });
    createdPlanId = plan.id;
    const fetched = await tenantDb().lessonPlan.findUnique({ where: { id: plan.id }, include: { resources: true } });
    assert(fetched?.strandId === strand.id && fetched?.competencyId === competency.id && fetched?.assessmentPlanId === aplan.id, "plan must persist all curriculum links");
    assert((fetched?.resources.length ?? 0) >= 1, "plan must persist initial resource");

    // ---- 2) record an observation directly from the plan ----
    const obs = await recordLessonObservation(user, { lessonPlanId: plan.id, studentId: student.id, level: 3, note: "Learner met the objective." });
    assert(obs.id, "observation must be created");
    const list = await listLessonObservations(user, plan.id);
    assert(list.length >= 1 && list[0].studentName && list[0].note.length > 0, "observation must list with learner + note");

    // reject another student's id mismatch is hard to set up here; check whole-class is allowed
    const wc = await recordLessonObservation(user, { lessonPlanId: plan.id, note: "Whole class engaged well." });
    assert(wc.studentId === null, "whole-class observation allowed (no studentId)");

    // ---- 3) attach more resources to existing plan ----
    const res = await addLessonResources(user, plan.id, [{ fileUrl: "https://example.com/video.mp4", fileName: "Demo video" }]);
    assert(res.length >= 2, "attach must add to existing resources");

    // ---- 4) score the assessment so the plan counts as 'assessed' ----
    await tenantDb().assessmentRecord.create({ data: { tenantId: tenant.id, planId: aplan.id, studentId: student.id, scorePct: 80, status: "SCORED", assessedById: user.id, assessedByName: user.fullName } as any });

    // ---- 5) analytics: planned vs taught vs assessed + coverage ----
    const an = await getLessonPlanningAnalytics(user, classId, subject.id);
    assert(an.totalPlans >= 1, "analytics must count plans");
    assert(typeof an.taughtPct === "number" && typeof an.assessedPct === "number", "analytics must expose taught% and assessed%");
    assert(an.assessedPlans >= 1, "the scored assessment plan must make at least one plan 'assessed'");
    assert(an.plansLinkedToAssessment >= 1, "must count plans linked to an assessment");
    assert(an.uniqueStrandsCovered >= 1 && an.uniqueCompetenciesTaught >= 1, "must count strand + competency coverage");
    assert(an.totalStrands >= 1 && typeof an.strandCoveragePct === "number", "must compute strand coverage %");

    // cleanup
    await tenantDb().assessmentRecord.deleteMany({ where: { planId: aplan.id } });
    await tenantDb().lessonObservation.deleteMany({ where: { lessonPlanId: plan.id } });
    await tenantDb().lessonResource.deleteMany({ where: { lessonPlanId: plan.id } });
    await tenantDb().lessonPlan.delete({ where: { id: plan.id } }).catch(() => {});
    await tenantDb().assessmentPlan.delete({ where: { id: aplan.id } }).catch(() => {});
    await tenantDb().competency.delete({ where: { id: competency.id } }).catch(() => {});
    await tenantDb().cbcStrand.delete({ where: { id: strand.id } }).catch(() => {});

    console.log("✓ J.12 full-stack test passed: curriculum links + observations + resources + planned/taught/assessed analytics + coverage.");
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
