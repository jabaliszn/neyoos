import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "screenshots/i52-public-homepage-odoo-inspired-desktop.png", fullPage: false });
  await b.close();
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });
