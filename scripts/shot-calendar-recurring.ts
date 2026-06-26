/** B.25 Calendar recurring events screenshots (123-124). Desktop 1920x1080 (G.32). */
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
  await page.goto(`${BASE}/calendar`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  for (const name of ["Got it", "Accept", "Accept all"]) {
    const b = page.getByRole("button", { name });
    if (await b.count()) { await b.first().click().catch(() => {}); break; }
  }
  await page.waitForTimeout(400);

  // Navigate forward to July 2026 (recurring seed lives there). Heading shows month/year.
  for (let i = 0; i < 18; i++) {
    const heading = (await page.locator("h2, h1").allInnerTexts()).join(" ");
    if (/July 2026/i.test(heading)) break;
    const next = page.getByRole("button", { name: /next|›|chevron-right/i }).first();
    if (await next.count()) { await next.click().catch(() => {}); } else {
      await page.keyboard.press("ArrowRight");
    }
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/123-calendar-recurring-month.png` });

  // Switch to Week view to show the "weekly" repeat badge clearly on the agenda
  const weekBtn = page.getByRole("button", { name: /^week$/i }).first();
  if (await weekBtn.count()) { await weekBtn.click().catch(() => {}); await page.waitForTimeout(1200); }
  await page.screenshot({ path: `${SHOTS}/124-calendar-recurring-week.png` });

  await browser.close();
  console.log("✓ screenshots 123-124 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
