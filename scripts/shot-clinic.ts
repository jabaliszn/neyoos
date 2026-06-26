/** B.21 Clinic screenshots (97-98). */
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await login(page, "deputy@karibuhigh.ac.ke");
  await page.goto(`${BASE}/clinic`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.keyboard.press("Escape");
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/97-clinic-visits.png` });
  await page.getByRole("button", { name: "Allergy register", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/98-clinic-allergies.png` });
  await browser.close();
  console.log("✓ screenshots 97-98 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
