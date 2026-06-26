import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const OUT = "screenshots/i52-public-homepage-batch2.png";
async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Product ecosystem", { timeout: 25000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT, fullPage: false });
  await browser.close();
  console.log(`✓ captured ${OUT}`);
}
main().catch((error) => { console.error(error); process.exit(1); });
