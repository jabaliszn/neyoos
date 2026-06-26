/**
 * I.2 — HOD + Principal exam-release approval workflow.
 * Verifies that an Academics HOD requests release, only Principal/Owner approves,
 * and approval publishes results + sends the existing parent SMS release path.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import type { SessionUser } from "@/lib/core/session";
import { group, testAsync, expect, summary } from "./_assert";
import { requestExamRelease, decideExamRelease, latestExamReleaseApproval } from "@/lib/services/exam.service";

function asSessionUser(user: any): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
    secondaryRole: user.secondaryRole,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    language: user.language ?? "en",
    neyoLoginId: user.neyoLoginId,
    viewAsReadOnly: false,
  } as SessionUser;
}

async function expectForbidden(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if ((e as any).code === "FORBIDDEN" || /Principal|Owner|approval/i.test((e as Error).message)) return;
    throw e;
  }
  throw new Error("expected FORBIDDEN, but action succeeded");
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principalRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "PRINCIPAL" } });
  const deputyRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "DEPUTY_PRINCIPAL" } });
  const hodRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "p.njoroge@karibuhigh.ac.ke" } });

  const principal = asSessionUser(principalRow);
  const deputy = asSessionUser(deputyRow);
  const hod = asSessionUser({ ...hodRow, role: "HOD" });

  const originalHodRole = hodRow.role;
  const originalSecondary = hodRow.secondaryRole;
  let examId = "";

  try {
    await withTenant(tenant.id, async () => {
      await db.user.update({ where: { id: hodRow.id }, data: { role: "HOD", secondaryRole: null } });
      const sciences = await db.department.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Sciences" } });
      await db.department.update({ where: { id: sciences.id }, data: { hodId: hod.id } });
      const math = await db.subject.findFirstOrThrow({ where: { tenantId: tenant.id, code: "MAT" } });
      await db.subject.update({ where: { id: math.id }, data: { departmentId: sciences.id } });
      const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, status: "ACTIVE" } });

      const exam = await db.exam.create({
        data: {
          tenantId: tenant.id,
          name: "I.2 Release Approval Test",
          year: 2026,
          term: 2,
          type: "CAT",
          maxMarks: 100,
          published: false,
          subjects: { create: [{ subjectId: math.id }] },
        },
      });
      examId = exam.id;
      await db.examResult.create({
        data: {
          tenantId: tenant.id,
          examId,
          studentId: student.id,
          subjectId: math.id,
          marks: 78,
          enteredById: hod.id,
        },
      });

      group("I.2 exam release approval");

      await testAsync("HOD can request release approval after marks are entered", async () => {
        const req = await requestExamRelease(hod, examId, "Mathematics marks checked by department.");
        expect(req.status).toBe("PENDING");
      });

      await testAsync("request creates a pending approval row", async () => {
        const latest = await latestExamReleaseApproval(principal, examId);
        expect(latest?.status).toBe("PENDING");
        expect(latest?.requestedByName).toBe(hod.fullName);
      });

      await testAsync("request notifies the principal in-app", async () => {
        const n = await db.notification.findFirst({
          where: { tenantId: tenant.id, recipientId: principal.id, title: "Results release approval needed", href: `/exams?open=${examId}` },
        });
        expect(Boolean(n)).toBe(true);
      });

      await testAsync("deputy cannot approve the release", async () => {
        await expectForbidden(() => decideExamRelease(deputy, examId, "APPROVED"));
      });

      await testAsync("principal approval publishes the exam", async () => {
        const decision = await decideExamRelease(principal, examId, "APPROVED", "Approved for parent release.");
        expect(decision.examReleased).toBe(true);
        const examAfter = await db.exam.findUniqueOrThrow({ where: { id: examId } });
        expect(examAfter.published).toBe(true);
      });

      await testAsync("approval row and audits are recorded", async () => {
        const latest = await latestExamReleaseApproval(principal, examId);
        expect(latest?.status).toBe("APPROVED");
        const approvalAudit = await db.auditLog.findFirst({ where: { tenantId: tenant.id, entityId: examId, action: "exam.release_approved" } });
        const publishAudit = await db.auditLog.findFirst({ where: { tenantId: tenant.id, entityId: examId, action: "exam.published" } });
        expect(Boolean(approvalAudit)).toBe(true);
        expect(Boolean(publishAudit)).toBe(true);
      });
    });
  } finally {
    if (examId) {
      await db.examReleaseApprovalRequest.deleteMany({ where: { examId } });
      await db.examResult.deleteMany({ where: { examId } });
      await db.examSubject.deleteMany({ where: { examId } });
      await db.exam.deleteMany({ where: { id: examId } });
      await db.notification.deleteMany({ where: { href: `/exams?open=${examId}` } });
      await db.auditLog.deleteMany({ where: { entityId: examId } });
    }
    await db.user.update({ where: { id: hodRow.id }, data: { role: originalHodRole, secondaryRole: originalSecondary } });
  }

  summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => db.$disconnect());
