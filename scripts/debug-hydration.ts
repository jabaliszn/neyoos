import { chromium } from "playwright";
async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("console", (msg) => console.log(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}\n${err.stack}`));
  for (const path of ["/", "/login", "/dashboard", "/settings/storage"]) {
    console.log(`\n--- ${path} ---`);
    await page.goto(`http://localhost:3000${path}`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log(`[goto-error] ${e.message}`));
    await page.waitForTimeout(2500);
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
