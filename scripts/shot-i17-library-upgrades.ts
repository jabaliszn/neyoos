import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "screenshots/i17-library-upgrades.png";

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.evaluate(async () => {
    await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "library@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
  });
  await page.goto(`${BASE}/library`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Issue a book", { timeout: 20000 });
  await page.getByRole("button", { name: "Issue a book", exact: true }).click();
  await page.waitForSelector("text=Built-in scanner", { timeout: 10000 });
  await page.screenshot({ path: OUT, fullPage: false });
  await browser.close();
  console.log(`✓ captured ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
