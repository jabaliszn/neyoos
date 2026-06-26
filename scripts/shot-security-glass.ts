/** B.22 Security + G.33 Liquid Glass screenshots (101-103, Full HD). */
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
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await login(page, "frontoffice@karibuhigh.ac.ke");

  // 101: Security page (light)
  await page.goto(`${BASE}/gate`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.keyboard.press("Escape");
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/101-security-gate.png` });

  // 102: panic tab
  await page.getByRole("button", { name: "Emergency", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/102-security-panic.png` });

  // 103: G.33 LIQUID GLASS theme on the dashboard
  await page.evaluate(() => {
    localStorage.setItem("neyo-theme", "glass");
    document.documentElement.classList.add("glass");
    document.documentElement.classList.remove("dark");
  });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/103-liquid-glass-dashboard.png` });

  await browser.close();
  console.log("✓ screenshots 101-103 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
