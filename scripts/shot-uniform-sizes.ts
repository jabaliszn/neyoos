/** B.25 — 115 staff sizes board, 116 portal order dialog w/ size pills (mobile). */
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
  await page.waitForTimeout(2000); await page.getByText("Uniform sizes", { exact: false }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/115-uniform-sizes-board.png` });
  console.log("115 ✓ staff sizes board");

  // Parent: portal order dialog with size pills (mobile).
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await mctx.newPage();
  await m.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const parentEmail = await m.evaluate(async () => {
    // login as the seeded parent via known login id route: use email+password
    const r = await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "parent@karibuhigh.ac.ke", password: "Karibu2026!" }) });
    return (await r.json()).ok;
  });
  console.log("parent login ok:", parentEmail);
  await m.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
  await m.waitForTimeout(2500);
  const mc = m.locator("button", { hasText: /got it/i }).first();
  if (await mc.isVisible().catch(() => false)) await mc.click();
  // open the child card
  await m.locator("text=KH-S-000001").first().click().catch(() => {});
  await m.waitForTimeout(2500);
  // scroll to uniform card + open order dialog
  const orderBtn = m.locator("button", { hasText: /^Order$/ }).first();
  await orderBtn.scrollIntoViewIfNeeded().catch(() => {});
  await orderBtn.click().catch(() => {});
  await m.waitForTimeout(1200);
  await m.screenshot({ path: `${OUT}/116-uniform-order-sizes.png` });
  console.log("116 ✓ portal order dialog w/ size pills");
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
