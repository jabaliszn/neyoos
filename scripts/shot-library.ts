/** B.15 Library + G.19 Class Chat screenshots (75-78). */
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

async function cookies(page: import("playwright-core").Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(300);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

  // Librarian: catalog
  await login(page, "library@karibuhigh.ac.ke");
  await page.goto(`${BASE}/library`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.keyboard.press("Escape");
  await cookies(page);
  await page.screenshot({ path: `${SHOTS}/75-library-catalog.png` });

  // Out now (overdue fine visible)
  await page.getByRole("button", { name: "Out now", exact: true }).click();
  await page.waitForTimeout(2000);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/76-library-out-fines.png` });

  // Issue tab w/ barcode flow
  await page.getByRole("button", { name: "Issue a book", exact: true }).click();
  await page.waitForTimeout(1600);
  await page.locator('input[placeholder="9789966882XXX"]').fill("9789966564184");
  await page.getByRole("button", { name: /Find/ }).click();
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/77-library-barcode-issue.png` });

  // G.19: parent opens class group chat on mobile
  const mob = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await login(mob, "parent@karibuhigh.ac.ke");
  await mob.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(2800);
  await mob.keyboard.press("Escape");
  await cookies(mob);
  await mob.locator("button:has-text('KH-S-000001')").first().click();
  await mob.waitForTimeout(2800);
  // tap the Class group chat button
  await mob.getByRole("button", { name: /Class group chat/ }).click();
  await mob.waitForTimeout(4500); // navigates to /messages?open=
  await mob.keyboard.press("Escape");
  await mob.screenshot({ path: `${SHOTS}/78-class-chat-mobile.png` });

  await browser.close();
  console.log("✓ screenshots 75-78 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
