import { chromium } from "playwright";
import path from "node:path";
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const parentUser = await db.user.findFirstOrThrow({ where: { email: "parent@karibuhigh.ac.ke" } });
  const guardian = await db.guardian.findFirstOrThrow({ where: { userId: parentUser.id } });

  const neverBilled = await withTenant(tenant.id, async () => {
    const tdb = tenantDb();
    const cls = await tdb.schoolClass.findFirst({ where: { archived: false } });
    const s = await tdb.student.create({
      data: { admissionNo: `SHOT-R2-${Date.now()}`, firstName: "Shot", lastName: "NeverBilled", gender: "F", classId: cls?.id ?? null } as never,
    });
    await tdb.studentGuardian.create({ data: { studentId: s.id, guardianId: guardian.id, relationship: "Parent", isPrimary: false } as never });
    return s;
  });

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(60000);
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "parent@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Login failed: ${JSON.stringify(login)}`);

  await page.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Fee balance", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "r2-parent-portal-fees-honesty.png"), fullPage: true });
  console.log("✅ Screenshot captured: r2-parent-portal-fees-honesty.png");

  await browser.close();

  await withTenant(tenant.id, async () => {
    const tdb = tenantDb();
    await tdb.studentGuardian.deleteMany({ where: { studentId: neverBilled.id } });
    await db.student.delete({ where: { id: neverBilled.id } });
  });
  console.log("cleanup ✓ (seeded screenshot student removed)");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
