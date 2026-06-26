/** Login page on Liquid Glass (default system) — 110 light, 111 dark, 112 mobile. */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function main() {
  const browser = await chromium.launch();
  // Fresh context = NO localStorage = pure default experience (glass).
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const cookieBtn = page.locator("button", { hasText: /got it/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) await cookieBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/110-login-glass-light.png` });
  console.log("110 ✓ login glass light (default, no stored prefs)");

  // Glass dark.
  await page.evaluate(() => localStorage.setItem("neyo-theme", "glass-dark"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/111-login-glass-dark.png` });
  console.log("111 ✓ login glass dark");

  // Mobile 360px (Kenyan baseline), default glass.
  const mctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const m = await mctx.newPage();
  await m.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await m.waitForTimeout(2500);
  const mc = m.locator("button", { hasText: /got it/i }).first();
  if (await mc.isVisible().catch(() => false)) await mc.click();
  await m.waitForTimeout(300);
  await m.screenshot({ path: `${OUT}/112-login-glass-mobile.png` });
  console.log("112 ✓ login glass mobile");
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
