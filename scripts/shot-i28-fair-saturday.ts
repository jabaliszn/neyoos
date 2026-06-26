import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("neyo-cookie-ack", new Date().toISOString());
    localStorage.setItem("neyo-pwa-install-dismissed", "true");
    localStorage.setItem("neyo_island_notifications", JSON.stringify(["seed1","seed2","seed3"]));
  });
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto("http://localhost:3000/academics", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.locator('button').filter({ hasText: /^Timetable$/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Bulk Saturday Scheduler/i }).click();
  await page.waitForTimeout(800);
  await page.getByText(/Fair rotation mode/i).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/i28-fair-saturday-scheduler.png", fullPage: false });
  await browser.close();
  console.log("✓ screenshots/i28-fair-saturday-scheduler.png");
}
main();
