import { chromium } from "playwright";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.evaluate(async () => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "achieng@karibuhigh.ac.ke", password: "Karibu2026!" }) }); });
  await page.waitForTimeout(600);
  await page.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.keyboard.press("Escape");
  await page.locator("text=Achieng Mary Otieno").first().click();
  await page.waitForTimeout(3000);
  await page.keyboard.press("Escape");
  const tt = page.locator("text=Timetable");
  if (await tt.count() > 0) await tt.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/64-student-portal.png` });
  await browser.close();
  console.log("✓ 64 captured, timetable card present:", await tt.count() > 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
