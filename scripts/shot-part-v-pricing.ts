import { chromium } from "playwright";
import { db } from "@/lib/db";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  // Public quote page — no login needed. Students + staff only now.
  await page.goto("http://localhost:3000/quote", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.fill("#q-students", "300");
  await page.fill("#q-staff", "20");
  await page.getByRole("button", { name: /see my price/i }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "screenshots/part-v-01-public-quote-page.png", fullPage: false });

  // NEYO Ops — Pricing Engine tab.
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "support@neyo.co.ke", password: "Karibu2026!" } });
  await page.goto("http://localhost:3000/founder", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Pricing Engine" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "screenshots/part-v-02-ops-pricing-engine-config.png", fullPage: false });

  // The onboarding wizard's live instant-price preview — students + staff only, CBE label.
  await page.goto("http://localhost:3000/get-started", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.fill("#school", "Verification Demo School");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForTimeout(600);
  await page.fill("#w-students", "250");
  await page.fill("#w-staff", "18");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "screenshots/part-v-05-onboarding-instant-price.png", fullPage: false });

  await browser.close();
  console.log("✓ screenshots re-captured with the CBE + students/staff-only fix");
}
main().finally(async () => db.$disconnect());
