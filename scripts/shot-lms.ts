/** B.13 LMS screenshots (69-72). */
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const SHOTS = "/home/user/screenshots";

async function login(page: import("playwright-core").Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (em) => {
    await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em, password: "Karibu2026!" }),
    });
  }, email);
}

async function dismissCookies(page: import("playwright-core").Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(300);
}

async function main() {
  const browser = await chromium.launch();

  // --- Teacher (Chebet): LMS quizzes + hand-ins ---
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await login(page, "f.chebet@karibuhigh.ac.ke");
  await page.goto(`${BASE}/lms`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.keyboard.press("Escape");
  await dismissCookies(page);
  await page.screenshot({ path: `${SHOTS}/69-lms-quizzes.png` });

  // quiz results drill-down
  await page.locator("text=Quadratics check-in quiz").first().click();
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/70-lms-quiz-results.png` });
  await page.getByRole("button", { name: "Quizzes" }).first().click();
  await page.waitForTimeout(800);

  // hand-ins grading tab
  await page.getByRole("button", { name: "Hand-ins", exact: true }).click();
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/71-lms-handins.png` });

  // --- Family portal (achieng on mobile): quiz taken + forum ---
  const mob = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await login(mob, "achieng@karibuhigh.ac.ke");
  await mob.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(3000);
  await mob.keyboard.press("Escape");
  const gotIt = mob.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {}); // dismiss BEFORE tapping the card
  await mob.waitForTimeout(400);
  // NB: she IS Achieng — "button:has-text('Achieng')" would hit the topbar
  // user chip. Target the child card via its admission number instead.
  await mob.locator("button:has-text('KH-S-000001')").first().click();
  await mob.waitForTimeout(3200);
  await mob.evaluate(() => {
    const els = Array.from(document.querySelectorAll("h3"));
    const q = els.find((e) => e.textContent?.includes("Quizzes"));
    q?.scrollIntoView({ block: "start" });
  });
  await mob.waitForTimeout(700);
  await mob.screenshot({ path: `${SHOTS}/72-portal-quiz-forum-mobile.png` });

  await browser.close();
  console.log("✓ screenshots 69-72 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
