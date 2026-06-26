/** G.12 Sibling Intelligence screenshot (125). Desktop 1920x1080 (G.32). */
import { chromium } from "playwright-core";
import { readFileSync } from "fs";

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
  const id = readFileSync("/tmp/achieng_id.txt", "utf8").trim();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await login(page, "principal@karibuhigh.ac.ke");
  await page.goto(`${BASE}/students/${id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  for (const name of ["Got it", "Accept", "Accept all"]) {
    const b = page.getByRole("button", { name });
    if (await b.count()) { await b.first().click().catch(() => {}); break; }
  }
  // scroll to the Family card
  await page.getByText("Family", { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/125-sibling-intelligence.png` });

  await browser.close();
  console.log("✓ screenshot 125 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
