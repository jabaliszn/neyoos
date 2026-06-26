import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "screenshots/i15-staff-import.png";

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.evaluate(async () => {
    await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
  });
  await page.goto(`${BASE}/staff`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Bulk Import Staff", { timeout: 20000 });
  await page.getByRole("button", { name: /Bulk Import Staff/i }).click();
  await page.waitForSelector("text=Accepted columns", { timeout: 10000 });
  await page.getByRole("button", { name: /Use sample CSV/i }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT, fullPage: false });
  await browser.close();
  console.log(`✓ captured ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
