/** B.18 Inventory screenshots (85-87). */
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const SHOTS = "/home/user/screenshots";

async function login(page: import("playwright-core").Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (em) => {
    await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em, password: "Karibu2026!" }),
    });
  }, email);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await login(page, "bursar@karibuhigh.ac.ke");
  await page.goto(`${BASE}/inventory`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.keyboard.press("Escape");
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/85-inventory-stock.png` });

  // Sell dialog (founder rule visible)
  await page.getByRole("button", { name: "Sell", exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.locator("select").first().selectOption({ index: 1 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/86-inventory-sell-to-invoice.png` });
  await page.getByLabel("Close").click();
  await page.waitForTimeout(400);

  // Family portal: the sweater invoice from the HTTP test (mobile)
  const mob = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await login(mob, "parent@karibuhigh.ac.ke");
  await mob.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(2800);
  await mob.keyboard.press("Escape");
  const gotIt2 = mob.getByRole("button", { name: "Got it" });
  if (await gotIt2.count()) await gotIt2.click().catch(() => {});
  await mob.locator("button:has-text('KH-S-000001')").first().click();
  await mob.waitForTimeout(3000);
  await mob.screenshot({ path: `${SHOTS}/87-portal-store-invoice-mobile.png` });

  await browser.close();
  console.log("✓ screenshots 85-87 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
