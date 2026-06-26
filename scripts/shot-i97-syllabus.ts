import { chromium } from "playwright";
import { db } from "@/lib/db";
import { createSyllabusTopic } from "@/lib/services/syllabus.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}

async function main() {
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: principal.tenantId, level: "Form 2", stream: "East" } });
  const subject = await db.subject.findFirstOrThrow({ where: { tenantId: principal.tenantId, code: "MAT" } }).catch(() => db.subject.findFirstOrThrow({ where: { tenantId: principal.tenantId } }));
  const topic = await createSyllabusTopic(principal, { classId: cls.id, subjectId: subject.id, topic: "Linear equations and inequalities", scopeRef: "KLB Bk 3 · Chapter 4", deadline: "2099-10-10" });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto("http://localhost:3000/syllabus", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "screenshots/i97-syllabus-coverage.png", fullPage: false });
  await browser.close();
  await db.syllabusTopic.delete({ where: { id: topic.id } }).catch(() => {});
  console.log("✓ screenshots/i97-syllabus-coverage.png");
}

main().finally(async () => db.$disconnect());
