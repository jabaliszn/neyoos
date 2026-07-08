import { chromium } from "playwright";
import path from "node:path";
const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");
const STUDENT_ID = "cmr3qyhyl0051tsxnus8pzsm8";
async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.evaluate(async () => {
    await fetch("/api/auth/password/login", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }) });
  });
  await page.goto(`${BASE}/students/${STUDENT_ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(2000);
  const heading = page.getByText("Senior School Pathway", { exact: true });
  await heading.waitFor({ timeout: 20000 });
  await heading.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 350);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "p4-kjsea-badge.png") });
  await browser.close();
  console.log("done");
}
main().catch(e => { console.error(e); process.exit(1); });
