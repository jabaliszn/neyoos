import { chromium, type Page } from "playwright";
const BASE = "http://localhost:3000"; const OUT = "/home/user/screenshots";
async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(800);
  await page.evaluate(async ({ email }) => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Karibu2026!" }) }); }, { email });
}
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 860 } });
  // 39 public apply form (dev tenant override)
  await page.goto(`${BASE}/apply?tenant=karibu-high`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/39-apply-public.png` });
  // 40 pipeline board
  await login(page, "principal@karibuhigh.ac.ke");
  await page.goto(`${BASE}/admissions`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/40-admissions-board.png` });
  // 41 application drawer (open the OFFER card — Collins)
  await page.click("text=Collins Omondi");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/41-admissions-drawer.png` });
  await browser.close();
  console.log("✓ 39-41 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
