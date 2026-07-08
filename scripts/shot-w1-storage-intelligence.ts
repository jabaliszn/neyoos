import { chromium } from "playwright";
import { db } from "@/lib/db";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "support@neyo.co.ke", password: "Karibu2026!" } });

  await page.goto("http://localhost:3000/founder", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Storage Intelligence" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "screenshots/w1-01-storage-intelligence-tab.png", fullPage: false });

  await page.getByRole("button", { name: "Pricing Engine" }).click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.32));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/w1-02-pricing-engine-alumni-toggle.png", fullPage: false });

  await browser.close();
  console.log("✓ screenshots captured");
}
main().finally(async () => db.$disconnect());
