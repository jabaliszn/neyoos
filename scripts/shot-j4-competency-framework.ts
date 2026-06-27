import { chromium } from "playwright";
import path from "node:path";
import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";
import { ensureDefaultCompetencyFramework, recordCompetencyEvidence, approveCompetencyEvidence } from "../src/lib/services/competency.service";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots", "j4-competency-framework.png");

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof db.user.findFirst>>>): SessionUser {
  return { id: user.id, tenantId: user.tenantId, neyoLoginId: user.neyoLoginId, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role as SessionUser["role"], secondaryRole: (user.secondaryRole as SessionUser["secondaryRole"]) ?? null, language: user.language ?? "en" };
}

async function ensureDemoCompetency() {
  const principalRow = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const principal = toSessionUser(principalRow);
  await ensureDefaultCompetencyFramework(principal);
  const competency = await db.competency.findFirstOrThrow({ where: { tenantId: principal.tenantId, code: "COMMUNICATION" } });
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: principal.tenantId, level: "Form 2", stream: "East" } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId: principal.tenantId, classId: cls.id, status: "ACTIVE", deletedAt: null } });
  let evidence = await db.competencyEvidence.findFirst({ where: { tenantId: principal.tenantId, competencyId: competency.id, studentId: student.id, sourceModule: "MANUAL" } });
  if (!evidence) {
    evidence = await recordCompetencyEvidence(principal, {
      competencyId: competency.id,
      studentId: student.id,
      sourceModule: "MANUAL",
      level: 4,
      scorePct: 88,
      narrative: "Achieng explained her project confidently and listened well during feedback.",
      evidenceDate: "2026-07-01",
    });
  }
  if (!evidence.approved || !evidence.visibleToParents) await approveCompetencyEvidence(principal, { evidenceId: evidence.id, approved: true, visibleToParents: true });
}

async function main() {
  await ensureDemoCompetency();
  await db.$disconnect();
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }) });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Could not sign in for screenshot: ${JSON.stringify(login)}`);
  await page.goto(`${BASE}/competencies`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.getByRole("heading", { name: "Competency Framework", exact: true }).waitFor({ timeout: 10000 });
  await page.getByText("Communication", { exact: true }).first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: OUT, fullPage: false });
  console.log("✓ screenshots/j4-competency-framework.png");
  await browser.close();
}
main().catch(async (error) => { console.error(error); await db.$disconnect().catch(() => {}); process.exit(1); });
