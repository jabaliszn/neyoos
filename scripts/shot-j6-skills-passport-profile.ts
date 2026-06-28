import { chromium } from "playwright";
import path from "node:path";
import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";
import { recordSkillRating } from "../src/lib/services/skills-passport.service";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots", "j6-skills-passport-profile.png");

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof db.user.findFirst>>>): SessionUser {
  return { id: user.id, tenantId: user.tenantId, neyoLoginId: user.neyoLoginId, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role as SessionUser["role"], secondaryRole: (user.secondaryRole as SessionUser["secondaryRole"]) ?? null, language: user.language ?? "en" };
}

async function ensureDemoSkillsPassport() {
  const principalRow = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const principal = toSessionUser(principalRow);
  const student = await db.student.findFirstOrThrow({ where: { tenantId: principal.tenantId, firstName: "Achieng" } });

  const existing = await db.skillsPassportEntry.findFirst({ where: { studentId: student.id, skillArea: "Leadership" } });
  if (!existing) {
    await recordSkillRating(principal, {
      studentId: student.id,
      skillArea: "Leadership",
      ratingLevel: 5,
      evidenceSource: "CLUB",
      narrative: "Elected as Class Prefect and leads environmental club activities effectively.",
      evidenceDate: "2026-06-26",
      verified: true,
    });
  }
  return student.id;
}

async function main() {
  const studentId = await ensureDemoSkillsPassport();
  await db.$disconnect();
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route("**/*.{woff,woff2,ttf,otf}", (route) => route.abort());
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }) });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Could not sign in for screenshot: ${JSON.stringify(login)}`);
  await page.goto(`${BASE}/students/${studentId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  console.log(`Waiting for Next.js compilation of /students/${studentId} and /api/skills-passport...`);
  await page.getByText("Download passport PDF").waitFor({ timeout: 90000 });
  await page.getByText("Talent & Leadership Growth").waitFor({ timeout: 90000 });
  await page.getByText("Talent & Leadership Growth").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: OUT, fullPage: false });
  console.log("✓ screenshots/j6-skills-passport-profile.png");
  await browser.close();
}
main().catch(async (error) => { console.error(error); await db.$disconnect().catch(() => {}); process.exit(1); });
