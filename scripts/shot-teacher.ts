/** B.12 Teacher Portal screenshots (65-68). */
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

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

  // Teacher portal — overview (Chebet)
  await login(page, "f.chebet@karibuhigh.ac.ke");
  await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.keyboard.press("Escape");
  // dismiss cookie banner so it doesn't cover content / block clicks
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/65-teacher-overview.png` });

  // Homework tab
  await page.getByRole("button", { name: "Homework", exact: true }).click();
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/66-teacher-homework.png` });

  // Assign homework dialog
  await page.getByRole("button", { name: "Assign homework" }).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/66b-assign-dialog.png` });
  await page.getByLabel("Close").click(); // dialog closes via ✕, not Escape
  await page.waitForTimeout(500);

  // Class report tab
  await page.getByRole("button", { name: "Class report", exact: true }).click();
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/67-teacher-class-report.png` });

  // Family portal — homework + notes visible (parent, mobile 360px)
  const mob = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await login(mob, "parent@karibuhigh.ac.ke");
  await mob.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(3000);
  // open the child
  await mob.locator("button:has-text('Achieng')").first().click();
  await mob.waitForTimeout(2800);
  await mob.keyboard.press("Escape");
  // scroll to the homework card
  await mob.evaluate(() => {
    const els = Array.from(document.querySelectorAll("h3"));
    const hw = els.find((e) => e.textContent?.includes("Homework"));
    hw?.scrollIntoView({ block: "start" });
  });
  await mob.waitForTimeout(700);
  await mob.screenshot({ path: `${SHOTS}/68-portal-homework-mobile.png` });

  await browser.close();
  console.log("✓ screenshots 65-68 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
