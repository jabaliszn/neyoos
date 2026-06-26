/** B.14 Communication screenshots (73-74). */
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

  // Principal: compose + history
  await login(page, "principal@karibuhigh.ac.ke");
  await page.goto(`${BASE}/comms`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.keyboard.press("Escape");
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(300);

  // Fill a message + run the preview so the cost card shows
  await page.locator("textarea").fill("School closes for half-term on Friday 19th June at noon. Buses leave 1pm sharp. Karibuni.");
  await page.getByRole("button", { name: /Check recipients/ }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SHOTS}/73-comms-preview.png` });

  // Teacher view (class-scoped notice), mobile
  const mob = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await login(mob, "f.chebet@karibuhigh.ac.ke");
  await mob.goto(`${BASE}/comms`, { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(3200);
  await mob.keyboard.press("Escape");
  const gotIt2 = mob.getByRole("button", { name: "Got it" });
  if (await gotIt2.count()) await gotIt2.click().catch(() => {});
  await mob.waitForTimeout(300);
  await mob.screenshot({ path: `${SHOTS}/74-comms-teacher-mobile.png` });

  await browser.close();
  console.log("✓ screenshots 73-74 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
