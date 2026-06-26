import { chromium } from "playwright";
import { db } from "@/lib/db";
import { createStructure } from "@/lib/services/finance.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}

async function main() {
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const user = asUser(principalRaw);
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: user.tenantId, level: "Form 2", stream: "East" } });
  await db.feeStructure.deleteMany({ where: { tenantId: user.tenantId, classId: cls.id, year: 2098, term: 3 } });
  await createStructure(user, { level: "Form 2", classId: cls.id, year: 2098, term: 3, items: [{ label: "Exact stream tuition", amountKes: 41800 }] });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto("http://localhost:3000/finance", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Fee structures" }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "screenshots/i35-class-specific-fees.png", fullPage: false });
  await browser.close();

  await db.feeItem.deleteMany({ where: { structure: { tenantId: user.tenantId, classId: cls.id, year: 2098, term: 3 } } });
  await db.feeStructure.deleteMany({ where: { tenantId: user.tenantId, classId: cls.id, year: 2098, term: 3 } });
  console.log("✓ screenshots/i35-class-specific-fees.png");
}

main().finally(async () => db.$disconnect());
