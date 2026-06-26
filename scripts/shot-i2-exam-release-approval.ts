import { chromium } from "playwright";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import type { SessionUser } from "@/lib/core/session";
import { requestExamRelease } from "@/lib/services/exam.service";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, role: u.role, secondaryRole: u.secondaryRole, fullName: u.fullName, email: u.email, phone: u.phone, language: u.language ?? "en", neyoLoginId: u.neyoLoginId, viewAsReadOnly: false } as SessionUser;
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const hodRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "p.njoroge@karibuhigh.ac.ke" } });
  const originalRole = hodRow.role;
  const originalSecondary = hodRow.secondaryRole;
  let examId = "";

  try {
    await withTenant(tenant.id, async () => {
      await db.user.update({ where: { id: hodRow.id }, data: { role: "HOD", secondaryRole: null } });
      const sciences = await db.department.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Sciences" } });
      await db.department.update({ where: { id: sciences.id }, data: { hodId: hodRow.id } });
      const math = await db.subject.findFirstOrThrow({ where: { tenantId: tenant.id, code: "MAT" } });
      await db.subject.update({ where: { id: math.id }, data: { departmentId: sciences.id } });
      const students = await db.student.findMany({ where: { tenantId: tenant.id, status: "ACTIVE" }, take: 3 });
      const exam = await db.exam.create({ data: { tenantId: tenant.id, name: "I.2 Principal Release Review", year: 2026, term: 2, type: "CAT", maxMarks: 100, subjects: { create: [{ subjectId: math.id }] } } });
      examId = exam.id;
      for (let i = 0; i < students.length; i++) {
        await db.examResult.create({ data: { tenantId: tenant.id, examId, studentId: students[i].id, subjectId: math.id, marks: 72 + i * 5, enteredById: hodRow.id } });
      }
      await requestExamRelease(asUser({ ...hodRow, role: "HOD" }), examId, "Department checked the marks and class mean.");
    });

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
    await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
    await page.goto(`http://localhost:3000/exams?open=${examId}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Principal release approval") || document.body.innerText.includes("Approve & release"), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "screenshots/i2-exam-release-approval.png", fullPage: false });
    await browser.close();
    console.log("✓ screenshots/i2-exam-release-approval.png");
  } finally {
    if (examId) {
      await db.examReleaseApprovalRequest.deleteMany({ where: { examId } });
      await db.examResult.deleteMany({ where: { examId } });
      await db.examSubject.deleteMany({ where: { examId } });
      await db.exam.deleteMany({ where: { id: examId } });
      await db.notification.deleteMany({ where: { href: `/exams?open=${examId}` } });
      await db.auditLog.deleteMany({ where: { entityId: examId } });
    }
    await db.user.update({ where: { id: hodRow.id }, data: { role: originalRole, secondaryRole: originalSecondary } });
  }
}

main().finally(async () => db.$disconnect());
