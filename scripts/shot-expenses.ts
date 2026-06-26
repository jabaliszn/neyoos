/** B.25 Expenses screenshots (121-122). Desktop 1920x1080 (G.32). */
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const SHOTS = "/home/user/screenshots";

async function login(page: import("playwright-core").Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (em) => {
    await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em, password: "Karibu2026!" }),
    });
  }, email);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await login(page, "principal@karibuhigh.ac.ke");
  await page.goto(`${BASE}/inventory`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  // dismiss cookie banner if present
  for (const name of ["Got it", "Accept", "Accept all"]) {
    const b = page.getByRole("button", { name });
    if (await b.count()) { await b.first().click().catch(() => {}); break; }
  }
  await page.waitForTimeout(500);

  // Expenses tab (button contains the label text)
  await page.locator("button:has-text('Expenses')").first().click({ timeout: 15000 });
  await page.waitForTimeout(1800);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/121-expenses-spend.png` });

  // Reports view
  await page.locator("button:has-text('Reports')").first().click({ timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/122-expenses-reports.png` });

  await browser.close();
  console.log("✓ screenshots 121-122 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
