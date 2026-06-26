import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const OUT = "screenshots/i50-multi-os-login.png";
async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/os/business/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=NEYO Business OS", { timeout: 25000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT, fullPage: false });
  await browser.close();
  console.log(`✓ captured ${OUT}`);
}
main().catch((error) => { console.error(error); process.exit(1); });
