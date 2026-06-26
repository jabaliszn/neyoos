import { chromium } from "playwright";
import { db } from "@/lib/db";

async function main() {
  const deputy = await db.user.findFirstOrThrow({ where: { email: "deputy@karibuhigh.ac.ke" } });
  await db.intercomCall.deleteMany({ where: { tenantId: deputy.tenantId, status: { in: ["RINGING", "ACCEPTED"] } } });
  await db.session.create({ data: { token: `shot-deputy-online-${Date.now()}`, userId: deputy.id, expiresAt: new Date(Date.now() + 3600_000) } });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "screenshots/i68-dashboard-intercom-online.png", fullPage: false });

  const enabledCall = page.locator('button:has-text("Call"):not([disabled])').first();
  await enabledCall.click();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: "screenshots/i69-intercom-ringing.png", fullPage: false });

  await browser.close();
  await db.session.deleteMany({ where: { token: { startsWith: "shot-deputy-online-" } } });
  await db.intercomCall.deleteMany({ where: { tenantId: deputy.tenantId, status: { in: ["RINGING", "ACCEPTED"] } } });
  console.log("✓ screenshots/i68-dashboard-intercom-online.png");
  console.log("✓ screenshots/i69-intercom-ringing.png");
}

main().finally(async () => db.$disconnect());
