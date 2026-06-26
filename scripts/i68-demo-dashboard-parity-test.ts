import { chromium } from "playwright";
import { db } from "@/lib/db";

async function main() {
  console.log("I.68 demo dashboard parity test");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));

  const start = await page.request.post("http://localhost:3000/api/demo/start");
  const json = await start.json();
  if (!json.ok) throw new Error(json.error?.message || "Demo start failed");

  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const body = await page.textContent("body");
  if (!body?.includes("Demo school")) throw new Error("Demo banner did not render on dashboard");
  if (!body.includes("Outstanding Fees")) throw new Error("Dashboard money-first cards missing in demo");
  if (!body.includes("Tuition Collections vs Expected Target")) throw new Error("Dashboard graph missing in demo");

  await page.screenshot({ path: "screenshots/i68-demo-dashboard-parity.png", fullPage: false });

  const tenantSlug = json.data.tenantSlug as string;
  const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (tenant) {
    const users = await db.user.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
    await db.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await db.user.deleteMany({ where: { tenantId: tenant.id } });
    await db.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
  }

  await browser.close();
  console.log("  ✓ demo dashboard loads with same cards/graph");
  console.log("  ✓ screenshots/i68-demo-dashboard-parity.png");
  console.log("\n✅ I.68 demo dashboard parity test passed");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => db.$disconnect());
