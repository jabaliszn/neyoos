import { chromium } from "playwright";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 860 } });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.evaluate(async () => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }) }); });
  await page.waitForTimeout(500);
  await page.goto(`${BASE}/exams`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  await page.locator("text=CAT 1 — Term 2").first().click();
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/49-exam-results.png` });
  // marks entry
  await page.locator("button", { hasText: /^Enter marks$/ }).first().click();
  await page.waitForTimeout(1000);
  const selects = page.locator("select");
  await selects.nth(0).selectOption({ label: "Form 2 East" });
  await page.waitForTimeout(600);
  await selects.nth(1).selectOption({ label: "Mathematics" });
  await page.waitForTimeout(2000);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/50-marks-entry.png` });
  await browser.close();
  console.log("✓ 49-50 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
