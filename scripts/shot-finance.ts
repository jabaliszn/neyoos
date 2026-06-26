import { chromium } from "playwright";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 880 } });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.evaluate(async () => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "bursar@karibuhigh.ac.ke", password: "Karibu2026!" }) }); });
  await page.waitForTimeout(500);
  await page.goto(`${BASE}/finance`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2400);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/54-finance-overview.png` });
  await page.locator("button", { hasText: /^Invoices$/ }).first().click();
  await page.waitForTimeout(2000);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/55-finance-invoices.png` });
  await page.locator("button", { hasText: /^Fee structures$/ }).first().click();
  await page.waitForTimeout(1800);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/56-fee-structures.png` });
  await browser.close();
  console.log("✓ 54-56 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
