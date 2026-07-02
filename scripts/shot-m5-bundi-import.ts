import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // School-side: Bundi import wizard
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.evaluate(async () => {
    await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
  });
  await page.goto(`${BASE}/students/import/bundi`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "m5-bundi-import-01-unlock.png"), fullPage: false });

  // NEYO Ops: Bundi Import tab
  const opsPage = await ctx.newPage();
  await opsPage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await opsPage.waitForTimeout(700);
  await opsPage.evaluate(async () => {
    await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "support@neyo.co.ke", password: "Karibu2026!" }),
    });
  });
  await opsPage.goto(`${BASE}/founder`, { waitUntil: "domcontentloaded" });
  await opsPage.waitForTimeout(2000);
  await opsPage.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await opsPage.getByText("Bundi Import", { exact: true }).click().catch(() => {});
  await opsPage.waitForTimeout(1500);
  await opsPage.screenshot({ path: path.join(OUT, "m5-bundi-import-02-ops-tab.png"), fullPage: false });

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
