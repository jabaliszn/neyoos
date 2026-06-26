import { chromium } from "playwright";
import { db } from "@/lib/db";
import { issueGatePass } from "@/lib/services/security.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: (u.secondaryRole ?? null) as Role | null, language: u.language ?? "en" };
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const hodRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } });
  const originalRole = hodRow.role;
  const originalSecondary = hodRow.secondaryRole;
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, status: "ACTIVE" } });

  await db.user.update({ where: { id: hodRow.id }, data: { role: "HOD", secondaryRole: null } });
  const hod = asUser(await db.user.findUniqueOrThrow({ where: { id: hodRow.id } }));
  const pass = await issueGatePass(hod, {
    studentId: student.id,
    reason: "HOD proposed clinic follow-up",
    leaveAt: "2026-06-23T10:00:00.000Z",
    escortName: "Auntie Njeri",
  });

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
    await page.request.post("http://localhost:3000/api/auth/password/login", {
      data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" },
    });
    await page.goto("http://localhost:3000/gate", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("pending approval") && document.body.innerText.includes("Approve"), null, { timeout: 30000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: "screenshots/i7-gate-discipline-authority.png", fullPage: false });
    await browser.close();
    console.log("✓ screenshots/i7-gate-discipline-authority.png");
  } finally {
    await db.gatePass.deleteMany({ where: { id: pass.id } });
    await db.user.update({ where: { id: hodRow.id }, data: { role: originalRole, secondaryRole: originalSecondary } });
  }
}

main().finally(async () => db.$disconnect());
