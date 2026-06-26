import { chromium } from "playwright";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 880 } });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.evaluate(async () => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "reception@karibuhigh.ac.ke", password: "Karibu2026!" }) }); });
  // fallback: find actual receptionist email
  const me = await page.evaluate(async () => (await (await fetch("/api/auth/me")).json()));
  if (!me?.data?.user) {
    await page.evaluate(async () => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "s.mwangi@karibuhigh.ac.ke", password: "Karibu2026!" }) }); });
  }
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/reception`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  await page.locator("button", { hasText: /M-Pesa fees/ }).first().click();
  await page.waitForTimeout(700);
  await page.fill('input[placeholder="Name or admission no…"]', "Kamau");
  await page.waitForTimeout(1200);
  await page.locator("text=Kamau Mwangi").first().click();
  await page.waitForTimeout(1200);
  await page.fill('input[placeholder="07XX XXX XXX"]', "0733 221 100");
  await page.screenshot({ path: `${OUT}/58-desk-stk.png` });
  await browser.close();
  console.log("✓ 58 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
