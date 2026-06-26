/** B.16 Hostel screenshots (79-81). */
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

  // Hostel master: dorm cards
  await login(page, "hostel@karibuhigh.ac.ke");
  await page.goto(`${BASE}/hostel`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.keyboard.press("Escape");
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/79-hostel-dorms.png` });

  // Room/bed board for Simba House
  await page.locator("button:has-text('Rooms & beds')").first().click();
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/80-hostel-beds.png` });

  // Curfew register (mobile — housemasters use phones at night)
  const mob = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await login(mob, "hostel@karibuhigh.ac.ke");
  await mob.goto(`${BASE}/hostel`, { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(3000);
  await mob.keyboard.press("Escape");
  const gotIt2 = mob.getByRole("button", { name: "Got it" });
  if (await gotIt2.count()) await gotIt2.click().catch(() => {});
  await mob.getByRole("button", { name: "Curfew register", exact: true }).click();
  await mob.waitForTimeout(2500);
  // mark one boarder In so the pills show state
  await mob.locator("button:has-text('In')").first().click().catch(() => {});
  await mob.waitForTimeout(500);
  await mob.screenshot({ path: `${SHOTS}/81-hostel-curfew-mobile.png` });

  await browser.close();
  console.log("✓ screenshots 79-81 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
