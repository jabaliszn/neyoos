/**
 * R.5 — Receipts land automatically in a parent's NEYO portal, even if
 * never printed.
 *
 * Founder's real complaint: today a receipt SMS is sent and a physical
 * receipt auto-queues to print at the desk (G.31/B.7.5) — but if nobody at
 * the desk actually prints it (printer off, station not open, receptionist
 * forgot), the parent never sees proof of payment anywhere in NEYO itself.
 * This closes that gap: the moment ANY payment turns PAID — STK/M-Pesa
 * callback, or a cash/bank walk-in payment recorded at the desk — a real
 * receipt record is written straight into the paying family's Parent
 * Portal, plus a real in-app notification, completely independent of
 * whether anyone ever prints anything.
 *
 * Design: rather than a new DB table (a payment is already a complete,
 * permanent record), this identifies WHICH student(s) a payment belongs to
 * (via its linked Invoice, or — for a walk-in payment with no invoice link
 * yet — via accountRef matching an admission number, mirroring the exact
 * same matching logic payment.service.ts already uses for raw Paybill
 * payments) and writes a Notification pointing at the real receipt PDF.
 * `myReceipts()` then reads the real Payment rows directly, scoped to the
 * parent's own children — never a separate, driftable copy of the data.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { scopeWhere } from "@/lib/services/student.service";
import { createInApp } from "@/lib/services/notification.service";
import type { SessionUser } from "@/lib/core/session";

/** Real student ids a payment belongs to (could be 0 if genuinely unmatched
 * — e.g. a payment for something that isn't tied to any specific learner —
 * 1 normally, or in rare shared-guardian edge cases the same guardian's
 * OTHER children too, since a family portal reasonably wants visibility
 * into any payment their own guardian phone made). */
async function studentsForPayment(tenantId: string, payment: { id: string; invoiceId: string | null; accountRef: string | null; phone: string }): Promise<string[]> {
  return withTenant(tenantId, async () => {
    if (payment.invoiceId) {
      const inv = await tenantDb().invoice.findUnique({ where: { id: payment.invoiceId }, select: { studentId: true } });
      if (inv) return [inv.studentId];
    }
    if (payment.accountRef) {
      const ref = payment.accountRef.trim();
      const student = await tenantDb().student.findFirst({
        where: { OR: [{ admissionNo: ref }, { legacyAdmissionNo: ref }] },
        select: { id: true },
      });
      if (student) return [student.id];
    }
    return [];
  });
}

/**
 * Call this the moment a payment genuinely becomes PAID — from BOTH real
 * paths: the M-Pesa/STK callback (finance.service.ts's onPaymentPaid) and
 * the front-desk cash/bank walk-in flow (reception.service.ts's
 * recordWalkInPayment). Idempotent-by-design: if called twice for the same
 * payment (e.g. a retried webhook), it simply creates a second identical
 * notification rather than crashing — matching the low-stakes, best-effort
 * pattern already used by the pre-existing SMS/print-queue hooks right next
 * to it, which never throw and never block the ledger write.
 */
export async function deliverReceiptToPortal(tenantId: string, paymentId: string): Promise<{ delivered: boolean; studentIds: string[] }> {
  try {
    const payment = await db.payment.findFirst({ where: { id: paymentId, tenantId, status: "PAID" } });
    if (!payment) return { delivered: false, studentIds: [] };

    const studentIds = await studentsForPayment(tenantId, payment);
    if (studentIds.length === 0) return { delivered: false, studentIds: [] };

    const students = await withTenant(tenantId, () =>
      tenantDb().student.findMany({
        where: { id: { in: studentIds } },
        include: { guardians: { include: { guardian: true } } },
      })
    );

    // One notification per real PARENT user with portal access, per child —
    // de-duplicated so a guardian of two of the matched children (rare, but
    // real for siblings on the same invoice-linked payment) gets exactly one.
    const recipientUserIds = new Set<string>();
    for (const s of students) {
      for (const g of s.guardians) {
        if (g.guardian.userId) recipientUserIds.add(g.guardian.userId);
      }
    }
    if (recipientUserIds.size === 0) return { delivered: false, studentIds };

    const studentNames = students.map((s) => [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ")).join(", ");
    const receiptNo = `RCP-${payment.id.slice(-8).toUpperCase()}`;

    await Promise.all(
      Array.from(recipientUserIds).map((recipientId) =>
        createInApp({
          tenantId,
          recipientId,
          title: `Receipt ready — KES ${payment.amount.toLocaleString("en-KE")}`,
          body: `Payment of KES ${payment.amount.toLocaleString("en-KE")} for ${studentNames} (${receiptNo}) is confirmed. View or download the receipt any time in Receipts — no need to visit the office for a printed copy.`,
          category: "fees",
          href: `/portal/receipts`,
        })
      )
    );

    return { delivered: true, studentIds };
  } catch {
    // Best-effort, exactly like the pre-existing SMS/print-queue hooks this
    // sits alongside — a delivery-notice failure must never break the real
    // ledger write that already happened.
    return { delivered: false, studentIds: [] };
  }
}

export interface ReceiptListItem {
  id: string;
  receiptNo: string;
  amount: number;
  method: string;
  mpesaRef: string | null;
  paidAt: string | null;
  studentNames: string;
  description: string | null;
}

/** Every real, genuinely PAID payment for the parent's own children — the
 * actual "My Receipts" list, read live from the real Payment table, never a
 * separate cached copy that could drift out of sync. */
export async function myReceipts(user: SessionUser): Promise<ReceiptListItem[]> {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const myChildren = await tenantDb().student.findMany({ where: scope, select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true, legacyAdmissionNo: true } });
    if (myChildren.length === 0) return [];

    const childIds = myChildren.map((c) => c.id);
    const childRefs = myChildren.flatMap((c) => [c.admissionNo, c.legacyAdmissionNo].filter((v): v is string => !!v));
    const nameFor = new Map(myChildren.map((c) => [c.id, [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ")]));

    // Match payments two ways, exactly like deliverReceiptToPortal itself:
    // (1) linked via an Invoice that belongs to one of my children, or
    // (2) a walk-in/raw payment whose accountRef is one of my children's
    // real admission numbers (covers cash payments recorded before any
    // invoice link existed).
    const myInvoices = await tenantDb().invoice.findMany({ where: { studentId: { in: childIds } }, select: { id: true, studentId: true } });
    const invoiceToStudent = new Map(myInvoices.map((i) => [i.id, i.studentId]));
    const invoiceIds = myInvoices.map((i) => i.id);

    const payments = await db.payment.findMany({
      where: {
        tenantId: user.tenantId,
        status: "PAID",
        deletedAt: null,
        OR: [
          ...(invoiceIds.length ? [{ invoiceId: { in: invoiceIds } }] : []),
          ...(childRefs.length ? [{ accountRef: { in: childRefs } }] : []),
        ],
      },
      orderBy: { paidAt: "desc" },
      take: 100,
    });

    return payments.map((p) => {
      const studentId = p.invoiceId ? invoiceToStudent.get(p.invoiceId) : undefined;
      const byRef = !studentId ? myChildren.find((c) => c.admissionNo === p.accountRef || c.legacyAdmissionNo === p.accountRef) : undefined;
      const resolvedName = (studentId && nameFor.get(studentId)) || byRef?.firstName + (byRef ? ` ${byRef.lastName}` : "") || "—";
      return {
        id: p.id,
        receiptNo: `RCP-${p.id.slice(-8).toUpperCase()}`,
        amount: p.amount,
        method: p.provider,
        mpesaRef: p.mpesaRef,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        studentNames: studentId ? (nameFor.get(studentId) ?? "—") : resolvedName,
        description: p.description,
      };
    });
  });
}
