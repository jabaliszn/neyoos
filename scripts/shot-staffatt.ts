import { chromium, type Page } from "playwright";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(800);
  await page.evaluate(async ({ email }) => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Karibu2026!" }) }); }, { email });
}
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 860 } });
  await login(page, "principal@karibuhigh.ac.ke");
  await page.goto(`${BASE}/attendance`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  // the tab pills are buttons inside the rounded-full tablist
  await page.locator("button", { hasText: /^Staff$/ }).first().click();
  await page.waitForTimeout(1800);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/42-staff-attendance.png` });
  await page.locator("button", { hasText: /^Insights$/ }).first().click();
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/43-attendance-insights.png` });
  await browser.close();
  console.log("✓ 42-43 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
