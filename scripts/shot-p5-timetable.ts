import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Login failed: ${JSON.stringify(login)}`);

  // Screenshot 1: Classes page with the Bulk create streams dialog open.
  await page.goto(`${BASE}/classes`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.getByText("Bulk create streams", { exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "p5-bulk-streams-dialog.png") });
  await page.keyboard.press("Escape").catch(() => {});

  // Screenshot 2: Academics -> Smart Timetable tab with the KICD template card.
  await page.goto(`${BASE}/academics`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  const smartTab = page.getByText("Smart Timetable", { exact: false }).first();
  await smartTab.click({ timeout: 8000 }).catch(async () => {
    // fallback: try a tab labelled just "Timetable"
    await page.getByText("Timetable", { exact: false }).first().click({ timeout: 5000 }).catch(() => {});
  });
  await page.waitForTimeout(3000);
  const heading = page.getByText("Official KICD Senior School template", { exact: false });
  await heading.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "p5-kicd-template-card.png") });

  await browser.close();
  console.log("✅ Screenshots captured: p5-bulk-streams-dialog.png, p5-kicd-template-card.png");
}
main().catch((e) => { console.error(e); process.exit(1); });
