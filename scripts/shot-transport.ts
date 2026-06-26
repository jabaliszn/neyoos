/** B.17 Transport screenshots (82-84). */
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

  await login(page, "principal@karibuhigh.ac.ke");
  await page.goto(`${BASE}/transport`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.keyboard.press("Escape");
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/82-transport-routes.png` });

  // Fleet tab (expiry alerts + km/L)
  await page.getByRole("button", { name: "Fleet", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/83-transport-fleet.png` });

  // Vehicle file (fuel + maintenance)
  await page.locator("button:has-text('KCB 123A')").first().click();
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/84-transport-vehicle-file.png` });

  await browser.close();
  console.log("✓ screenshots 82-84 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
