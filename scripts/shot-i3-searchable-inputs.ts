import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto("http://localhost:3000/clinic", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.locator("button", { hasText: "Record visit" }).first().click({ force: true });
  await page.waitForTimeout(600);
  await page.getByPlaceholder("Type learner name or admission number…").fill("Achieng");
  await page.waitForTimeout(700);
  await page.screenshot({ path: "screenshots/i3-searchable-learner-input.png", fullPage: false });
  await browser.close();
  console.log("✓ screenshots/i3-searchable-learner-input.png");
}

main();
