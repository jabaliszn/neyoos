import { chromium } from "playwright";
import { db } from "@/lib/db";
import { createInApp } from "@/lib/services/notification.service";

async function main() {
  const principal = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const notif = await createInApp({
    tenantId: principal.tenantId,
    recipientId: principal.id,
    title: "Delivery report ready",
    body: "3 read · 2 confirmed received · 1 not read",
    category: "message",
    href: "/messages",
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("neyo_island_notifications"));
  await page.request.post("http://localhost:3000/api/auth/password/login", {
    data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" },
  });
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "screenshots/i34-dynamic-island.png", fullPage: false });

  await page.getByLabel("Notifications").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "screenshots/i96-notification-panel.png", fullPage: false });
  await browser.close();

  await db.notification.delete({ where: { id: notif.id } }).catch(() => {});
  console.log("✓ screenshots/i34-dynamic-island.png");
  console.log("✓ screenshots/i96-notification-panel.png");
}

main().finally(async () => db.$disconnect());
