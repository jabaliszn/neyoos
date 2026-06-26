import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", {
    data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" },
  });
  await page.goto("http://localhost:3000/settings/visibility", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.innerText.includes("My School (owner metrics)") && document.body.innerText.includes("School Owner"), null, { timeout: 30000 });
  await page.locator("text=My School (owner metrics)").scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: "screenshots/i5-role-dashboard-visibility.png", fullPage: false });
  await browser.close();
  console.log("✓ screenshots/i5-role-dashboard-visibility.png");
}

main();
