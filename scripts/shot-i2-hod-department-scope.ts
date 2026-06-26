import { chromium } from "playwright";
import { db } from "@/lib/db";

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const hod = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "p.njoroge@karibuhigh.ac.ke" } });
  const sciences = await db.department.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Sciences" } });
  await db.department.update({ where: { id: sciences.id }, data: { hodId: hod.id } });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", {
    data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" },
  });
  await page.goto("http://localhost:3000/academics", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.locator("button").filter({ hasText: /^Departments$/ }).click({ force: true });
  await page.waitForFunction(() => document.body.innerText.includes("Sciences") && document.body.innerText.includes("HOD"), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: "screenshots/i2-hod-department-scope.png", fullPage: false });
  await browser.close();
  console.log("✓ screenshots/i2-hod-department-scope.png");
}

main().finally(async () => db.$disconnect());
