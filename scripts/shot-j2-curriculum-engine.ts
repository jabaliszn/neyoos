import { chromium } from "playwright";
import path from "node:path";
import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";
import { runCurriculumMigrationAssistant } from "../src/lib/services/curriculum.service";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots", "j2-curriculum-engine.png");

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

async function ensureCurriculumMigration() {
  const principalRow = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  await runCurriculumMigrationAssistant(toSessionUser(principalRow));
}

async function main() {
  await ensureCurriculumMigration();
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

  await page.goto(`${BASE}/settings/curriculum`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});

  const isLogin = await page.getByText("Sign in to NEYO", { exact: false }).count().catch(() => 0);
  if (isLogin) throw new Error("Screenshot would capture login page; authenticated curriculum page did not load.");
  await page.getByText("Curriculum Engine", { exact: true }).waitFor({ timeout: 10000 });

  await page.screenshot({ path: OUT, fullPage: false });
  console.log("✓ screenshots/j2-curriculum-engine.png");
  await browser.close();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
