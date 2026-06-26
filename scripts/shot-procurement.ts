/** B.25 Procurement screenshot (120) — verify-and-tick (UI was already built in inventory-client ProcurementTab). */
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
  // G.32 standing rule: desktop screenshots at 1920x1080
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await login(page, "principal@karibuhigh.ac.ke");
  await page.goto(`${BASE}/inventory`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.keyboard.press("Escape");
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(300);

  // Click the Procurement tab (button text contains "Procurement")
  await page.getByText("Procurement", { exact: false }).first().click();
  await page.waitForTimeout(2000);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/120-procurement.png` });

  await browser.close();
  console.log("✓ screenshot 120-procurement captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
