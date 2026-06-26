import { chromium } from "playwright";
import { db } from "@/lib/db";

const BASE = "http://localhost:3000";
const OUT = "screenshots/i24-promise-to-pay-calendar.png";

async function seedPromise() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const invoice = await db.invoice.findFirstOrThrow({ where: { tenantId: tenant.id, status: { in: ["UNPAID", "PARTIAL"] } } });
  const link = await db.studentGuardian.findFirstOrThrow({ where: { tenantId: tenant.id, studentId: invoice.studentId } });
  const date = new Date(Date.now() + 3 * 3600_000 + 2 * 24 * 3600_000).toISOString().slice(0, 10);
  await db.promiseToPay.deleteMany({ where: { tenantId: tenant.id, invoiceId: invoice.id, promiseDate: date } });
  await db.promiseToPay.create({ data: { tenantId: tenant.id, invoiceId: invoice.id, studentId: invoice.studentId, guardianId: link.guardianId, promiseDate: date, amountKes: 4500, status: "ACTIVE" } });
}

async function main() {
  await seedPromise();
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.evaluate(async () => { await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "bursar@karibuhigh.ac.ke", password: "Karibu2026!" }) }); });
  await page.goto(`${BASE}/finance`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Promises Calendar", { timeout: 20000 });
  await page.getByRole("button", { name: "Promises Calendar", exact: true }).click();
  await page.waitForSelector("text=Fee Promises Calendar Directory", { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT, fullPage: false });
  await browser.close();
  console.log(`✓ captured ${OUT}`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
