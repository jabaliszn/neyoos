/** B.24 Owner Dashboard — 113 desktop glass, 114 mobile. */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }) });
  });
  await page.goto(`${BASE}/owner`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const cookieBtn = page.locator("button", { hasText: /got it/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) await cookieBtn.click();
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/113-owner-dashboard.png` });
  console.log("113 ✓ owner dashboard desktop");

  const mctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const m = await mctx.newPage();
  await m.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await m.evaluate(async () => {
    await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }) });
  });
  await m.goto(`${BASE}/owner`, { waitUntil: "domcontentloaded" });
  await m.waitForTimeout(3500);
  const mc = m.locator("button", { hasText: /got it/i }).first();
  if (await mc.isVisible().catch(() => false)) await mc.click();
  await m.waitForTimeout(300);
  await m.screenshot({ path: `${OUT}/114-owner-mobile.png` });
  console.log("114 ✓ owner mobile");
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
