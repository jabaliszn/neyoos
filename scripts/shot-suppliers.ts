/** B.25 — 119 suppliers tab w/ ratings + contract badges. */
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
  await page.getByText("Suppliers", { exact: false }).first().click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/119-suppliers.png` });
  console.log("119 ✓ suppliers tab");
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
