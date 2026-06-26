/** B.19 Cafeteria screenshots (91-93). */
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await login(page, "bursar@karibuhigh.ac.ke");
  await page.goto(`${BASE}/cafeteria`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.keyboard.press("Escape");
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/91-cafeteria-kitchen-today.png` });

  // Week menu grid
  await page.getByRole("button", { name: "Week menu", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/92-cafeteria-week-menu.png` });

  // Meal cards w/ invoice link
  await page.getByRole("button", { name: "Meal cards", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Issue meal card" }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/93-cafeteria-issue-card.png` });

  await browser.close();
  console.log("✓ screenshots 91-93 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
