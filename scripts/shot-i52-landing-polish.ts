import { chromium } from "playwright";
const BASE = "http://localhost:3000";
async function shot(path: string, width: number, height: number) {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Product ecosystem", { timeout: 25000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path, fullPage: false });
  await browser.close();
  console.log(`✓ captured ${path}`);
}
async function main() {
  await shot("screenshots/i52-public-homepage-batch3-desktop.png", 1920, 1080);
  await shot("screenshots/i52-public-homepage-batch3-mobile.png", 390, 844);
}
main().catch((error) => { console.error(error); process.exit(1); });
