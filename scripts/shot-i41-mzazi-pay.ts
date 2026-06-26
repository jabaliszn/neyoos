import { chromium } from "playwright";
import { db } from "@/lib/db";
import { buildMzaziCardPdf } from "@/lib/services/mzazi.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}

async function main() {
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const open = await db.invoice.findFirstOrThrow({ where: { tenantId: principal.tenantId, status: { in: ["UNPAID", "PARTIAL"] } }, orderBy: { dueDate: "asc" } });
  const student = await db.student.findUniqueOrThrow({ where: { id: open.studentId }, include: { guardians: { include: { guardian: true } } } });
  await buildMzaziCardPdf(principal, student.id);
  const crypto = await import("crypto");
  const payloadHash = crypto.createHash("sha256").update(`mzazi:${principal.tenantId}:${student.id}`).digest("hex");
  const rec = await db.documentVerification.findFirstOrThrow({ where: { tenantId: principal.tenantId, docType: "mzazi_card", payloadHash } });
  const phone = student.guardians[0].guardian.phone;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await page.goto(`http://localhost:3000/mzazi/${rec.code}`, { waitUntil: "domcontentloaded" });
  await page.locator("input").first().fill(phone);
  await page.waitForTimeout(300);
  await page.locator('button[type="submit"]').click({ force: true });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "screenshots/i41-mzazi-direct-pay.png", fullPage: true });
  await browser.close();
  console.log("✓ screenshots/i41-mzazi-direct-pay.png");
}

main().finally(async () => db.$disconnect());
