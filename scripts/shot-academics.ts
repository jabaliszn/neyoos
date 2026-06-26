import { chromium } from "playwright";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 860 } });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }) });
  });
  await page.waitForTimeout(500);
  await page.goto(`${BASE}/academics`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/46-academics-subjects.png` });
  await page.locator("button", { hasText: /^Timetable$/ }).first().click();
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/47-academics-timetable.png` });
  await page.locator("button", { hasText: /^Terms$/ }).first().click();
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/48-academics-terms.png` });
  await browser.close();
  console.log("✓ 46-48 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
