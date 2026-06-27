import { chromium } from "playwright";
import path from "node:path";
import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";
import {
  attachAssessmentEvidence,
  ensureDefaultAssessmentTypes,
  createAssessmentPlan,
  moderateAssessmentRecord,
  releaseAssessmentPlan,
  scoreAssessmentRecord,
} from "../src/lib/services/assessment.service";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots", "j3-assessment-engine.png");

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof db.user.findFirst>>>): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    neyoLoginId: user.neyoLoginId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role as SessionUser["role"],
    secondaryRole: (user.secondaryRole as SessionUser["secondaryRole"]) ?? null,
    language: user.language ?? "en",
  };
}

async function ensureDemoAssessment() {
  const principalRow = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const principal = toSessionUser(principalRow);
  await ensureDefaultAssessmentTypes(principal);

  const [oral, cls, subject, term, curriculum, learningArea] = await Promise.all([
    db.assessmentType.findFirstOrThrow({ where: { tenantId: principal.tenantId, key: "ORAL" } }),
    db.schoolClass.findFirstOrThrow({ where: { tenantId: principal.tenantId, level: "Form 2", stream: "East" } }),
    db.subject.findFirstOrThrow({ where: { tenantId: principal.tenantId, code: "ENG" } }),
    db.academicTerm.findFirstOrThrow({ where: { tenantId: principal.tenantId, current: true } }),
    db.curriculum.findFirst({ where: { tenantId: principal.tenantId, name: "8-4-4 Legacy" } }),
    db.learningArea.findFirst({ where: { tenantId: principal.tenantId, code: "ENG" } }),
  ]);

  let plan = await db.assessmentPlan.findFirst({ where: { tenantId: principal.tenantId, title: "J3 Demo Oral Presentation" } });
  if (!plan) {
    plan = await createAssessmentPlan(principal, {
      assessmentTypeId: oral.id,
      curriculumId: curriculum?.id,
      learningAreaId: learningArea?.id,
      subjectId: subject.id,
      classId: cls.id,
      academicTermId: term.id,
      year: term.year,
      term: term.term,
      title: "J3 Demo Oral Presentation",
      description: "Learners explain a reading passage and respond to questions.",
      instructions: "Score clarity, confidence and evidence from the oral presentation.",
      weight: 10,
      maxMarks: 50,
      dueDate: "2026-07-20",
      status: "ACTIVE",
      visibleToParents: false,
    });
  }

  const student = await db.student.findFirstOrThrow({ where: { tenantId: principal.tenantId, classId: cls.id, status: "ACTIVE", deletedAt: null } });
  const record = await scoreAssessmentRecord(principal, {
    planId: plan.id,
    studentId: student.id,
    scoreMarks: 44,
    rubricLevel: 4,
    rubricCode: "EE",
    narrative: "Clear oral response with confident examples from the text.",
    sourceModule: "MANUAL",
    sourceId: plan.id,
  });
  const hasEvidence = await db.assessmentEvidence.findFirst({ where: { tenantId: principal.tenantId, recordId: record.id } });
  if (!hasEvidence) {
    await attachAssessmentEvidence(principal, { recordId: record.id, evidenceType: "NOTE", note: "Teacher checklist captured during the oral presentation." });
  }
  await moderateAssessmentRecord(principal, { recordId: record.id, status: "MODERATED", note: "Checked for demo screenshot." });
  await releaseAssessmentPlan(principal, { planId: plan.id, visibleToParents: true, note: "Released for demo screenshot." });
}

async function main() {
  await ensureDemoAssessment();
  await db.$disconnect();

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Could not sign in for screenshot: ${JSON.stringify(login)}`);

  await page.goto(`${BASE}/assessments`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.getByText("Flexible Assessments", { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText("J3 Demo Oral Presentation", { exact: true }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: OUT, fullPage: false });
  console.log("✓ screenshots/j3-assessment-engine.png");
  await browser.close();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
