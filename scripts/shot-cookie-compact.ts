import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("neyo-cookie-ack"));
  await page.request.post("http://localhost:3000/api/auth/password/login", {
    data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" },
  });
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "screenshots/i68-cookie-compact-dashboard.png", fullPage: false });
  await browser.close();
  console.log("✓ screenshots/i68-cookie-compact-dashboard.png");
}

main();
