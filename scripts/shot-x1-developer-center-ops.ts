import { chromium } from "playwright";
import { db } from "@/lib/db";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  const loginRes = await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "support@neyo.co.ke", password: "Karibu2026!" } });
  console.log("login status:", loginRes.status());
  await page.waitForTimeout(500);
  await page.goto("http://localhost:3000/founder", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Developer Center" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "screenshots/x1-03-ops-developer-center-dashboard.png", fullPage: false });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.65));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/x1-04-ops-partner-keys.png", fullPage: false });

  await browser.close();
  console.log("✓ screenshots captured");
}
main().finally(async () => db.$disconnect());
