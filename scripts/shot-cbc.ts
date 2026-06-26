import { chromium } from "playwright";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 880 } });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.evaluate(async () => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }) }); });
  await page.waitForTimeout(500);
  await page.goto(`${BASE}/cbc`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/52-cbc-strands.png` });
  // assess tab
  await page.locator("button", { hasText: /^Assess$/ }).first().click();
  await page.waitForTimeout(800);
  const sels = page.locator("select");
  await sels.nth(0).selectOption({ label: "Form 2 East" });
  await page.waitForTimeout(400);
  await sels.nth(1).selectOption({ index: 2 });
  await page.waitForTimeout(1800);
  // tap a couple of rubric pills for colour
  const ee = page.locator("button", { hasText: /^EE$/ });
  if (await ee.count() > 0) await ee.first().click();
  const ae = page.locator("button", { hasText: /^AE$/ });
  if (await ae.count() > 2) await ae.nth(2).click();
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/53-cbc-assess.png` });
  await browser.close();
  console.log("✓ 52-53 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
