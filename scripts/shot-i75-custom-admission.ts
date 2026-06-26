import { chromium } from "playwright";
import { db } from "@/lib/db";
import { createStudent } from "@/lib/services/student.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}

async function main() {
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const user = asUser(principalRaw);
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: user.tenantId, level: "Form 2", stream: "East" } });
  const legacy = `ADM-SHOT-${Date.now()}`;
  const created = await createStudent(user, { firstName: "Legacy", lastName: "Preview", gender: "F", classId: cls.id, legacyAdmissionNo: legacy, seedRequirements: false, guardians: [] } as any);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto(`http://localhost:3000/students/${created.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "screenshots/i75-custom-admission-profile.png", fullPage: false });

  await browser.close();
  await db.invoice.deleteMany({ where: { tenantId: user.tenantId, studentId: created.id } });
  await db.student.delete({ where: { id: created.id } });
  console.log("✓ screenshots/i75-custom-admission-profile.png");
}

main().finally(async () => db.$disconnect());
