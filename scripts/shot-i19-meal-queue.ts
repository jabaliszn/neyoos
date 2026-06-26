import { chromium } from "playwright";
import { db } from "@/lib/db";
import { joinMealQueue } from "@/lib/services/cafeteria.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}

async function main() {
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const students = await db.student.findMany({ where: { tenantId: principal.tenantId, status: "ACTIVE", deletedAt: null }, take: 2 });
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  await db.cafeteriaQueueEntry.deleteMany({ where: { tenantId: principal.tenantId, date: today, session: "LUNCH" } });
  for (const s of students) await joinMealQueue(principal, { studentId: s.id, session: "LUNCH", date: today }).catch(() => null);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto("http://localhost:3000/cafeteria", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Meal queue/i }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "screenshots/i19-meal-serving-queue.png", fullPage: false });
  await browser.close();
  await db.cafeteriaQueueEntry.deleteMany({ where: { tenantId: principal.tenantId, date: today, session: "LUNCH" } });
  console.log("✓ screenshots/i19-meal-serving-queue.png");
}

main().finally(async () => db.$disconnect());
