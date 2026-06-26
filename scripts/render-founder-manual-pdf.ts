import { chromium } from "playwright";
import { resolve } from "node:path";

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  const html = `file://${resolve("docs/NEYO-FOUNDER-MANUAL.html")}`;
  await page.goto(html, { waitUntil: "load" });
  await page.pdf({ path: "docs/NEYO-FOUNDER-MANUAL.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "screenshots/i55-founder-manual-cover.png", fullPage: false });
  await browser.close();
  console.log("✓ rendered docs/NEYO-FOUNDER-MANUAL.pdf");
  console.log("✓ captured screenshots/i55-founder-manual-cover.png");
}

main().catch((error) => { console.error(error); process.exit(1); });
