/** B.25 — 117 assets register w/ book values + due badges; 118 asset drawer. */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bursar@karibuhigh.ac.ke", password: "Karibu2026!" }) });
  });
  await page.goto(`${BASE}/inventory`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const cookieBtn = page.locator("button", { hasText: /got it/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) await cookieBtn.click();
  await page.getByText("Assets", { exact: false }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/117-assets-register.png` });
  console.log("117 ✓ assets register");
  await page.getByText("HP ProBook", { exact: false }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/118-asset-drawer.png` });
  console.log("118 ✓ asset drawer");
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
