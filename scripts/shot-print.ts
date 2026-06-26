/** G.31 Print station screenshots (99-100) — FULL HD 1920x1080 per founder. */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
const SHOTS = "/home/user/screenshots";
async function login(page: import("playwright-core").Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (em) => {
    await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em, password: "Karibu2026!" }),
    });
  }, email);
}
async function main() {
  const browser = await chromium.launch();
  // FOUNDER: desktop/laptop screenshots at FULL VIEW 1920x1080.
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await login(page, "frontoffice@karibuhigh.ac.ke");
  await page.goto(`${BASE}/print-station`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.keyboard.press("Escape");
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  // pause auto-print so the queue stays visible for the shot
  await page.getByRole("button", { name: /Auto-print/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/99-print-station-fullhd.png` });

  // Dashboard at full HD too (proof the layout fills the screen)
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/100-dashboard-fullhd.png` });
  await browser.close();
  console.log("✓ screenshots 99-100 captured at 1920x1080");
}
main().catch((e) => { console.error(e); process.exit(1); });
