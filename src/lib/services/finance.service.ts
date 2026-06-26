/**
 * B.7 Finance Part 1 — fee structures, batch + manual invoicing, balances,
 * arrears aging. Payments wiring (STK/receipts) lands in Part 2 on top of
 * the A.6 payment engine.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { nextTenantId } from "@/lib/services/identity.service";
import { scopeWhere } from "@/lib/services/student.service";
import type { SessionUser } from "@/lib/core/session";

export class FinanceError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "EMPTY" | "INVALID", message: string) {
    super(message);
    this.name = "FinanceError";
  }
}

async function audit(user: SessionUser, action: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType: "finance", entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Fee structures (B.7.1)
// ---------------------------------------------------------------------------

export async function listStructures(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().feeStructure.findMany({
      orderBy: [{ year: "desc" }, { term: "desc" }, { level: "asc" }],
      include: { items: true, _count: { select: { invoices: true } } },
    });
    return rows.map((s) => ({
      id: s.id, name: s.name, level: s.level, classId: s.classId, year: s.year, term: s.term,
      totalKes: s.items.reduce((a, i) => a + i.amountKes, 0),
      items: s.items.map((i) => ({ id: i.id, label: i.label, amountKes: i.amountKes })),
      invoiceCount: s._count.invoices,
    }));
  });
}

export async function createStructure(user: SessionUser, input: { level: string; classId?: string; year: number; term: number; items: { label: string; amountKes: number }[] }) {
  return withTenant(user.tenantId, async () => {
    const dup = await tenantDb().feeStructure.findFirst({ where: { level: input.level, classId: input.classId ?? null, year: input.year, term: input.term } });
    if (dup) throw new FinanceError("DUPLICATE", `A fee structure for ${input.level}${input.classId ? " (this exact class)" : ""}, Term ${input.term} ${input.year} already exists.`);
    let classLabel: string | null = null;
    if (input.classId) {
      const cls = await tenantDb().schoolClass.findUnique({ where: { id: input.classId } });
      if (!cls) throw new FinanceError("NOT_FOUND", "Class not found.");
      classLabel = [cls.level, cls.stream].filter(Boolean).join(" ");
    }
    const s = await tenantDb().feeStructure.create({
      data: {
        name: `${classLabel ?? input.level} — Term ${input.term} ${input.year}`,
        level: input.level, classId: input.classId ?? null, year: input.year, term: input.term,
        items: { create: input.items },
      } as never,
    });
    await audit(user, "finance.structure_created", s.id, { level: input.level, term: input.term, year: input.year });
    return s;
  });
}

// ---------------------------------------------------------------------------
// Invoicing (B.7.2/3)
// ---------------------------------------------------------------------------

function statusFor(total: number, paid: number): string {
  if (paid <= 0) return "UNPAID";
  if (paid >= total) return "PAID";
  return "PARTIAL";
}

/** Auto-batch: invoice EVERY active student whose class level matches. */
export async function batchInvoice(user: SessionUser, structureId: string, dueDate: string) {
  return withTenant(user.tenantId, async () => {
    const structure = await tenantDb().feeStructure.findUnique({ where: { id: structureId }, include: { items: true } });
    if (!structure) throw new FinanceError("NOT_FOUND", "Fee structure not found.");
    const total = structure.items.reduce((a, i) => a + i.amountKes, 0);

    const classes = await tenantDb().schoolClass.findMany({ where: structure.classId ? { id: structure.classId, archived: false } : { level: structure.level, archived: false } });
    const students = await tenantDb().student.findMany({
      where: { classId: { in: classes.map((c) => c.id) }, status: "ACTIVE" },
      select: { id: true },
    });
    if (students.length === 0) throw new FinanceError("EMPTY", `No active students in ${structure.level}.`);

    // Skip students already invoiced from this structure (idempotent batch).
    const existing = await tenantDb().invoice.findMany({
      where: { structureId, studentId: { in: students.map((s) => s.id) } },
      select: { studentId: true },
    });
    const skip = new Set(existing.map((e) => e.studentId));

    let created = 0;
    for (const st of students) {
      if (skip.has(st.id)) continue;

      // Calculate previous outstanding term arrears/balances (H.3)
      const pastInvoices = await tenantDb().invoice.findMany({
        where: {
          studentId: st.id,
          status: { in: ["UNPAID", "PARTIAL"] },
          OR: [
            { year: { lt: structure.year } },
            { year: structure.year, term: { lt: structure.term } }
          ]
        }
      });
      const arrears = pastInvoices.reduce((sum, inv) => sum + (inv.totalKes - inv.discountKes - inv.paidKes), 0);

      const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
      await tenantDb().invoice.create({
        data: {
          invoiceNo, studentId: st.id, structureId,
          description: `${structure.name} fees`,
          totalKes: total, dueDate, year: structure.year, term: structure.term,
        } as never,
      });

      // Automatically carry over previous term arrears as a separate unpaid invoice — idempotent per term.
      if (arrears > 0) {
        const existingCarry = await tenantDb().invoice.findFirst({
          where: { studentId: st.id, year: structure.year, term: structure.term, kind: "ARREARS" },
        });
        if (!existingCarry) {
          const arrearsInvoiceNo = await nextTenantId(user.tenantId, "INVOICE");
          await tenantDb().invoice.create({
            data: {
              invoiceNo: arrearsInvoiceNo, studentId: st.id,
              description: "Prior Term Arrears (Carry Over Balance)",
              totalKes: arrears, paidKes: 0, dueDate, year: structure.year, term: structure.term,
              status: "UNPAID", kind: "ARREARS",
            } as never,
          });
        }
      }

      created++;
    }
    await audit(user, "finance.batch_invoiced", structureId, { created, skipped: skip.size, total });
    return { created, skipped: skip.size, totalKes: total };
  });
}

export async function createManualInvoice(user: SessionUser, input: { studentId: string; description: string; totalKes: number; dueDate: string; year: number; term: number }) {
  return withTenant(user.tenantId, async () => {
    const student = await tenantDb().student.findUnique({ where: { id: input.studentId } });
    if (!student) throw new FinanceError("NOT_FOUND", "Student not found.");
    if (/(^|\s)(trip|tour|outing|excursion|travel|transport trip)(\s|$)/i.test(input.description)) {
      throw new FinanceError("INVALID", "Trips and excursions are school expenses/workflows, not fee deductions. Record the spend in Expenses, not as a student fee invoice.");
    }
    const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
    const inv = await tenantDb().invoice.create({
      data: {
        invoiceNo, studentId: input.studentId, description: input.description,
        totalKes: input.totalKes, dueDate: input.dueDate, year: input.year, term: input.term, kind: "MANUAL",
      } as never,
    });
    await audit(user, "finance.invoice_created", inv.id, { invoiceNo, totalKes: input.totalKes });
    return inv;
  });
}

/** Record a payment against an invoice (Part 2 wires M-Pesa; this is the ledger move). */
export async function applyPaymentToInvoice(user: SessionUser, invoiceId: string, amountKes: number) {
  return withTenant(user.tenantId, async () => {
    const inv = await tenantDb().invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new FinanceError("NOT_FOUND", "Invoice not found.");
    const paid = inv.paidKes + amountKes;
    const updated = await tenantDb().invoice.update({
      where: { id: invoiceId },
      data: { paidKes: paid, status: statusFor(inv.totalKes, paid) },
    });
    await audit(user, "finance.payment_applied", invoiceId, { amountKes, newStatus: updated.status });

    // G.31: when fees are paid the updated invoice (balances auto-computed)
    // prints itself at the reception station — no tap needed.
    try {
      const { queueInvoiceAfterPayment } = await import("@/lib/services/print-queue.service");
      await queueInvoiceAfterPayment(user.tenantId, invoiceId, `System (payment by ${user.fullName})`);
    } catch { /* best-effort */ }

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Lists, balances, arrears aging (B.7.9)
// ---------------------------------------------------------------------------

export async function listInvoices(user: SessionUser, filters: { status?: string; q?: string }) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user); // parents see own child's invoices
    const visible = await tenantDb().student.findMany({ where: scope, select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true, legacyAdmissionNo: true, schoolClass: { select: { level: true, stream: true } } } });
    const vMap = new Map(visible.map((s) => [s.id, s]));

    const where: Record<string, unknown> = { studentId: { in: [...vMap.keys()] } };
    if (filters.status) where.status = filters.status;

    let rows = await tenantDb().invoice.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });
    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter((r) => {
        const s = vMap.get(r.studentId);
        const name = s ? `${s.firstName} ${s.middleName ?? ""} ${s.lastName}`.toLowerCase() : "";
        return r.invoiceNo.toLowerCase().includes(q) || name.includes(q) || (s?.admissionNo.toLowerCase().includes(q) ?? false) || (s?.legacyAdmissionNo?.toLowerCase().includes(q) ?? false);
      });
    }
    return rows.map((r) => {
      const s = vMap.get(r.studentId);
      return {
        id: r.id, invoiceNo: r.invoiceNo, description: r.description,
        totalKes: r.totalKes, paidKes: r.paidKes, discountKes: r.discountKes,
        balanceKes: r.totalKes - r.discountKes - r.paidKes,
        status: r.status, dueDate: r.dueDate, year: r.year, term: r.term,
        studentId: r.studentId,
        studentName: s ? [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ") : "—",
        admissionNo: s?.legacyAdmissionNo ? `${s.legacyAdmissionNo} · ${s.admissionNo}` : (s?.admissionNo ?? "—"),
        className: s?.schoolClass ? [s.schoolClass.level, s.schoolClass.stream].filter(Boolean).join(" ") : null,
      };
    });
  });
}

// ---------------------------------------------------------------------------
// Part 2: M-Pesa STK for invoices, discounts, reminders
// ---------------------------------------------------------------------------

/** Status recompute helper honouring discounts (effective total = total - discount).
 *  A fully-waived invoice (due 0) counts as PAID even with zero payments. */
function effectiveStatus(inv: { totalKes: number; paidKes: number; discountKes: number }): string {
  const due = Math.max(0, inv.totalKes - inv.discountKes);
  if (due === 0) return "PAID";
  return statusFor(due, inv.paidKes);
}

/** B.7.4: STK push a parent's phone for an invoice balance (A.6 engine). */
export async function stkForInvoice(user: SessionUser, invoiceId: string, phone: string, amountKes?: number) {
  return withTenant(user.tenantId, async () => {
    const inv = await tenantDb().invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new FinanceError("NOT_FOUND", "Invoice not found.");
    const balance = inv.totalKes - inv.discountKes - inv.paidKes;
    if (balance <= 0) throw new FinanceError("EMPTY", "This invoice is already settled.");
    const amount = amountKes ?? balance;
    if (amount > balance) throw new FinanceError("EMPTY", `Amount exceeds the balance of KES ${balance.toLocaleString("en-KE")}.`);

    const { initiateStkPush } = await import("@/lib/services/payment.service");
    const result = await initiateStkPush(user.tenantId, {
      amount,
      phone,
      accountRef: inv.invoiceNo,
      description: inv.description,
    });
    // Link the pending payment to the invoice so the PAID callback applies it.
    await db.payment.update({ where: { id: result.paymentId }, data: { invoiceId: inv.id } });
    await audit(user, "finance.stk_initiated", invoiceId, { amount, phone, paymentId: result.paymentId });
    return result;
  });
}

/**
 * Callback hook (called from payment.service.handleCallback via seam below):
 * when a payment linked to an invoice lands PAID, apply it to the ledger and
 * send the parent a receipt SMS (A.7 seam, quota-checked).
 */
export async function onPaymentPaid(paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment?.invoiceId || payment.status !== "PAID") return;
  const inv = await db.invoice.findUnique({ where: { id: payment.invoiceId } });
  if (!inv) return;

  const paid = inv.paidKes + payment.amount;
  await db.invoice.update({
    where: { id: inv.id },
    data: { paidKes: paid, status: effectiveStatus({ ...inv, paidKes: paid }) },
  });
  await db.auditLog.create({
    data: {
      tenantId: payment.tenantId, actorName: "M-Pesa",
      action: "finance.invoice_paid_mpesa", entityType: "invoice", entityId: inv.id,
      metadata: JSON.stringify({ amount: payment.amount, mpesaRef: payment.mpesaRef }),
    },
  });

  // Receipt SMS to the payer (B.7.5) — dev seam logs; live with AT key.
  try {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: payment.tenantId }, select: { name: true } });
    const { checkSmsQuota, recordUsage } = await import("@/lib/services/limits.service");
    const quota = await checkSmsQuota(payment.tenantId, 1);
    if (quota.allowed) {
      const { sendSms } = await import("@/lib/notifications/sms");
      const balance = inv.totalKes - inv.discountKes - paid;
      await sendSms(
        payment.phone,
        `${tenant.name}: Payment of KES ${payment.amount.toLocaleString("en-KE")} received (${payment.mpesaRef}). ` +
        (balance > 0 ? `Balance: KES ${balance.toLocaleString("en-KE")}.` : `Invoice ${inv.invoiceNo} fully paid. Asante!`)
      );
      await recordUsage(payment.tenantId, "smsPerTerm", 1);
    }
  } catch { /* SMS failure must never break the ledger */ }

  // G.31: M-Pesa payments auto-print receipt + updated invoice at the desk.
  try {
    const { queueReceiptForPayment, queueInvoiceAfterPayment } = await import("@/lib/services/print-queue.service");
    await queueReceiptForPayment(payment.tenantId, payment.id, "System (M-Pesa)");
    await queueInvoiceAfterPayment(payment.tenantId, inv.id, "System (M-Pesa)");
  } catch { /* best-effort */ }
}

/** B.7.11: scholarships / discounts / bursaries as a waiver on the invoice. */
export async function applyDiscount(user: SessionUser, invoiceId: string, amountKes: number, reason: string) {
  return withTenant(user.tenantId, async () => {
    const inv = await tenantDb().invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new FinanceError("NOT_FOUND", "Invoice not found.");
    const discount = inv.discountKes + amountKes;
    if (discount > inv.totalKes) throw new FinanceError("EMPTY", "Discount cannot exceed the invoice total.");
    const updated = await tenantDb().invoice.update({
      where: { id: invoiceId },
      data: {
        discountKes: discount,
        discountReason: reason,
        status: effectiveStatus({ totalKes: inv.totalKes, paidKes: inv.paidKes, discountKes: discount }),
      },
    });
    await audit(user, "finance.discount_applied", invoiceId, { amountKes, reason, newStatus: updated.status });
    return updated;
  });
}

/** B.7+ open invoices for ONE student (the receptionist desk flow). */
export async function studentOpenInvoices(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] } });
    if (!student) throw new FinanceError("NOT_FOUND", "Student not found.");
    const rows = await tenantDb().invoice.findMany({
      where: { studentId, status: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { dueDate: "asc" },
    });
    return rows.map((r) => ({
      id: r.id, invoiceNo: r.invoiceNo, description: r.description,
      totalKes: r.totalKes, paidKes: r.paidKes, discountKes: r.discountKes,
      balanceKes: r.totalKes - r.discountKes - r.paidKes, dueDate: r.dueDate, status: r.status,
    }));
  });
}

/** B.7+ invoice PDF w/ PRINT TRACKING: increments printCount, stamps who/when. */
export async function buildInvoicePdf(user: SessionUser, invoiceId: string) {
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, tenantId: user.tenantId } });
  if (!inv) throw new FinanceError("NOT_FOUND", "Invoice not found.");
  const [tenant, student, payments, guardianLink] = await Promise.all([
    db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } }),
    db.student.findUniqueOrThrow({ where: { id: inv.studentId }, include: { schoolClass: true } }),
    db.payment.findMany({ where: { invoiceId: inv.id, status: "PAID" }, orderBy: { paidAt: "asc" } }),
    db.studentGuardian.findFirst({ where: { studentId: inv.studentId, isPrimary: true }, include: { guardian: true } }),
  ]);

  // Print tracking (founder request): every render counts + is audited.
  const updated = await db.invoice.update({
    where: { id: inv.id },
    data: { printCount: { increment: 1 }, lastPrintedAt: new Date(), lastPrintedBy: user.fullName },
  });
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action: "finance.invoice_printed", entityType: "invoice", entityId: inv.id,
      metadata: JSON.stringify({ invoiceNo: inv.invoiceNo, copyNumber: updated.printCount }),
    },
  });

  const { issueVerification } = await import("@/lib/services/document.service");
  const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");
  const { renderInvoicePdf } = await import("@/lib/documents/invoice-pdf");
  const letterNo = `INV-${inv.id.slice(-8).toUpperCase()}`;
  const code = await issueVerification(
    user.tenantId, "fee_invoice",
    `${inv.invoiceNo} — ${student.firstName} ${student.lastName}: ${inv.status}, balance KES ${(inv.totalKes - inv.discountKes - inv.paidKes).toLocaleString("en-KE")}`,
    { invoiceNo: inv.invoiceNo, status: inv.status, paidKes: inv.paidKes }
  );

  const { logoAsDataUrl } = await import("@/lib/documents/school-stamp");
  const pdf = await renderInvoicePdf({
    schoolName: tenant.name, motto: tenant.motto, county: tenant.county,
    addressLine: tenant.addressLine, brandPrimary: tenant.brandPrimary || "#1c2740",
    logoDataUrl: await logoAsDataUrl(tenant.logoUrl), // G.25 logo on invoice + stamp
    invoiceNo: inv.invoiceNo, description: inv.description,
    studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
    admissionNo: student.admissionNo,
    className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
    guardianName: guardianLink?.guardian.fullName ?? null,
    totalKes: inv.totalKes, discountKes: inv.discountKes, discountReason: inv.discountReason,
    paidKes: inv.paidKes, balanceKes: inv.totalKes - inv.discountKes - inv.paidKes,
    status: inv.status, dueDate: inv.dueDate,
    payments: payments.map((p) => ({
      date: (p.paidAt ?? p.createdAt).toISOString().slice(0, 10),
      amountKes: p.amount, ref: p.mpesaRef, method: p.provider === "cash" ? "Cash" : "M-Pesa",
    })),
    copyNumber: updated.printCount,
    letterNo, verifyCode: code, qrDataUrl: await qrDataUrl(verifyUrl(code)),
    issuedDate: new Date().toISOString().slice(0, 10), issuedByName: user.fullName,
  });
  return { pdf, fileName: `${inv.invoiceNo}.pdf` };
}

/**
 * B.7.12: overdue-fee reminder job body (A.12 cron). SMS the primary guardian
 * of every overdue invoice — quota-checked, deduped (one SMS per 3 days).
 */
export async function sendFeeReminders(tenantId: string) {
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600_000);
  const overdue = await db.invoice.findMany({
    where: {
      tenantId,
      status: { in: ["UNPAID", "PARTIAL"] },
      dueDate: { lt: today },
      OR: [{ reminderSentAt: null }, { reminderSentAt: { lt: threeDaysAgo } }],
    },
    take: 100,
  });
  if (overdue.length === 0) return { sent: 0, skipped: 0 };

  const { checkSmsQuota, recordUsage } = await import("@/lib/services/limits.service");
  const quota = await checkSmsQuota(tenantId, overdue.length);
  if (!quota.allowed) return { sent: 0, skipped: overdue.length, message: quota.message };

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
  const { sendSms } = await import("@/lib/notifications/sms");
  let sent = 0; let skipped = 0;

  for (const inv of overdue) {
    const link = await db.studentGuardian.findFirst({
      where: { studentId: inv.studentId, isPrimary: true },
      include: { guardian: true, student: { select: { firstName: true, lastName: true } } },
    }) ?? await db.studentGuardian.findFirst({
      where: { studentId: inv.studentId },
      include: { guardian: true, student: { select: { firstName: true, lastName: true } } },
    });
    if (!link?.guardian.phone) { skipped++; continue; }
    const balance = inv.totalKes - inv.discountKes - inv.paidKes;
    try {
      await sendSms(
        link.guardian.phone,
        `${tenant.name}: Fee balance of KES ${balance.toLocaleString("en-KE")} for ${link.student.firstName} ${link.student.lastName} (${inv.invoiceNo}) was due ${inv.dueDate}. Kindly clear at your earliest. Asante.`
      );
      await db.invoice.update({ where: { id: inv.id }, data: { reminderSentAt: new Date() } });
      sent++;
    } catch { skipped++; }
  }
  if (sent > 0) {
    await recordUsage(tenantId, "smsPerTerm", sent);
    await db.auditLog.create({
      data: {
        tenantId, actorName: "NEYO Reminders",
        action: "finance.reminders_sent", entityType: "finance", entityId: tenantId,
        metadata: JSON.stringify({ sent, skipped }),
      },
    });
  }
  return { sent, skipped };
}
export async function arrearsAging(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    const open = await tenantDb().invoice.findMany({ where: { status: { in: ["UNPAID", "PARTIAL"] } } });
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
    let totalOutstanding = 0;
    for (const inv of open) {
      const bal = inv.totalKes - inv.discountKes - inv.paidKes;
      totalOutstanding += bal;
      const overdueDays = Math.floor((new Date(today).getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      if (overdueDays <= 0) buckets.current += bal;
      else if (overdueDays <= 30) buckets.d30 += bal;
      else if (overdueDays <= 60) buckets.d60 += bal;
      else buckets.d90 += bal;
    }
    const collected = await tenantDb().invoice.aggregate({ _sum: { paidKes: true } });
    const billed = await tenantDb().invoice.aggregate({ _sum: { totalKes: true } });
    return {
      totalOutstanding,
      collectedKes: collected._sum.paidKes ?? 0,
      billedKes: billed._sum.totalKes ?? 0,
      collectionRate: billed._sum.totalKes ? Math.round(((collected._sum.paidKes ?? 0) / billed._sum.totalKes) * 100) : 0,
      buckets,
      openCount: open.length,
    };
  });
}


/** I.99 — one-tap fee reminders to every family with an open balance.
 * Sends respectful, balance-aware SMS and in-app reminders where parent accounts
 * are linked. Uses invoice.reminderSentAt to avoid accidental repeat blasting.
 */
export async function sendAllOpenFeeReminders(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const open = await tenantDb().invoice.findMany({
      where: { status: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { dueDate: "asc" },
      take: 500,
    });
    if (open.length === 0) return { sentSms: 0, sentInApp: 0, skipped: 0, totalBalanceKes: 0, families: 0 };

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true } });
    const { sendSms } = await import("@/lib/notifications/sms");
    const { checkSmsQuota, recordUsage } = await import("@/lib/services/limits.service");
    const { createInApp } = await import("@/lib/services/notification.service");

    const byGuardian = new Map<string, { phone: string | null; userId: string | null; guardianName: string; studentNames: Set<string>; balance: number; invoiceIds: string[]; accountRefs: Set<string> }>();
    let totalBalanceKes = 0;
    for (const inv of open) {
      const balance = Math.max(0, inv.totalKes - inv.discountKes - inv.paidKes);
      if (balance <= 0) continue;
      totalBalanceKes += balance;
      const link = await tenantDb().studentGuardian.findFirst({
        where: { studentId: inv.studentId, isPrimary: true },
        include: { guardian: true, student: true },
      }) ?? await tenantDb().studentGuardian.findFirst({ where: { studentId: inv.studentId }, include: { guardian: true, student: true } });
      if (!link) continue;
      const key = link.guardian.userId || link.guardian.phone || link.guardian.id;
      const row = byGuardian.get(key) ?? { phone: link.guardian.phone, userId: link.guardian.userId, guardianName: link.guardian.fullName, studentNames: new Set<string>(), balance: 0, invoiceIds: [], accountRefs: new Set<string>() };
      row.studentNames.add([link.student.firstName, link.student.lastName].filter(Boolean).join(" "));
      row.accountRefs.add(link.student.legacyAdmissionNo || link.student.admissionNo);
      row.balance += balance;
      row.invoiceIds.push(inv.id);
      byGuardian.set(key, row);
    }

    const quota = await checkSmsQuota(user.tenantId, [...byGuardian.values()].filter((g) => g.phone).length);
    let sentSms = 0, sentInApp = 0, skipped = 0;
    for (const g of byGuardian.values()) {
      const names = [...g.studentNames].slice(0, 2).join(", ");
      const accountRefs = [...g.accountRefs].slice(0, 2).join(" / ");
      const body = `${tenant.name}: Dear ${g.guardianName}, fee balance for ${names} is KES ${g.balance.toLocaleString("en-KE")}. You may pay any amount by M-Pesa using account ${accountRefs}, or open the parent portal/Mzazi QR for live balance. Asante.`;
      if (g.phone && quota.allowed) {
        const r = await sendSms(g.phone, body);
        if (r.ok) sentSms++; else skipped++;
      } else if (g.phone && !quota.allowed) skipped++;
      if (g.userId) {
        await createInApp({ tenantId: user.tenantId, recipientId: g.userId, title: "Fee balance reminder", body, category: "fees", href: "/portal" });
        sentInApp++;
      }
      await db.invoice.updateMany({ where: { id: { in: g.invoiceIds } }, data: { reminderSentAt: new Date() } });
    }
    if (sentSms > 0) await recordUsage(user.tenantId, "smsPerTerm", sentSms);
    await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "finance.one_tap_reminders_sent", entityType: "finance", entityId: user.tenantId, metadata: JSON.stringify({ sentSms, sentInApp, skipped, families: byGuardian.size, totalBalanceKes }) } });
    return { sentSms, sentInApp, skipped, totalBalanceKes, families: byGuardian.size, quota: quota.status };
  });
}

/** I.99 — class/stream fee collection leaderboard. */
export async function feeCollectionLeaderboard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const classes = await tenantDb().schoolClass.findMany({
      where: { archived: false },
      include: { students: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } } },
      orderBy: [{ level: "asc" }, { stream: "asc" }],
    });
    const teacherIds = classes.map((c) => c.classTeacherId).filter((x): x is string => Boolean(x));
    const teachers = teacherIds.length ? await tenantDb().user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, fullName: true } }) : [];
    const tMap = new Map(teachers.map((t) => [t.id, t.fullName]));
    const rows = [];
    for (const cls of classes) {
      const studentIds = cls.students.map((s) => s.id);
      const invoices = studentIds.length ? await tenantDb().invoice.findMany({ where: { studentId: { in: studentIds } } }) : [];
      const billedKes = invoices.reduce((sum, i) => sum + Math.max(0, i.totalKes - i.discountKes), 0);
      const collectedKes = invoices.reduce((sum, i) => sum + Math.min(i.paidKes, Math.max(0, i.totalKes - i.discountKes)), 0);
      const outstandingKes = invoices.reduce((sum, i) => sum + Math.max(0, i.totalKes - i.discountKes - i.paidKes), 0);
      rows.push({
        classId: cls.id,
        className: [cls.level, cls.stream].filter(Boolean).join(" "),
        classTeacherName: cls.classTeacherId ? tMap.get(cls.classTeacherId) ?? "Assigned teacher" : "No class teacher",
        learnerCount: cls.students.length,
        billedKes,
        collectedKes,
        outstandingKes,
        collectionRate: billedKes > 0 ? Math.round((collectedKes / billedKes) * 100) : 0,
      });
    }
    return rows.sort((a, b) => b.collectionRate - a.collectionRate || b.collectedKes - a.collectedKes);
  });
}

/** I.99 — daily/weekly automated fee digest to Bursar + Principal. */
export async function sendFinanceDigest(tenantId: string, cadence: "daily" | "weekly" = "daily") {
  const now = new Date();
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const start = cadence === "weekly" ? new Date(now.getTime() - 7 * 24 * 3600_000) : new Date(`${today}T00:00:00.000Z`);
  if (cadence === "daily") start.setUTCHours(start.getUTCHours() - 3);

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
  const [paid, invoices, recipients] = await Promise.all([
    db.payment.aggregate({ _sum: { amount: true }, where: { tenantId, status: "PAID", paidAt: { gte: start } } }),
    db.invoice.findMany({ where: { tenantId, status: { in: ["UNPAID", "PARTIAL"] } }, orderBy: { dueDate: "asc" }, take: 500 }),
    db.user.findMany({ where: { tenantId, isActive: true, role: { in: ["BURSAR", "ACCOUNTANT", "PRINCIPAL", "SCHOOL_OWNER"] } }, select: { id: true, fullName: true, phone: true } }),
  ]);
  const collectedKes = paid._sum.amount ?? 0;
  const outstandingKes = invoices.reduce((s, i) => s + Math.max(0, i.totalKes - i.discountKes - i.paidKes), 0);
  const top = invoices
    .map((i) => ({ invoiceNo: i.invoiceNo, balance: Math.max(0, i.totalKes - i.discountKes - i.paidKes) }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 3);
  const topText = top.map((t) => `${t.invoiceNo}: KES ${t.balance.toLocaleString("en-KE")}`).join("; ") || "none";
  const message = `${tenant.name} ${cadence} fees digest: collected KES ${collectedKes.toLocaleString("en-KE")}; outstanding KES ${outstandingKes.toLocaleString("en-KE")}; open invoices ${invoices.length}; top balances: ${topText}.`;
  const { sendSms } = await import("@/lib/notifications/sms");
  const { createInApp } = await import("@/lib/services/notification.service");
  const { checkSmsQuota, recordUsage } = await import("@/lib/services/limits.service");
  const quota = await checkSmsQuota(tenantId, recipients.filter((r) => r.phone).length);
  let sentSms = 0, sentInApp = 0, skipped = 0;
  for (const r of recipients) {
    await createInApp({ tenantId, recipientId: r.id, title: `${cadence === "daily" ? "Daily" : "Weekly"} fees digest`, body: message, category: "fees", href: "/finance" });
    sentInApp++;
    if (r.phone && quota.allowed) {
      const res = await sendSms(r.phone, message);
      if (res.ok) sentSms++; else skipped++;
    } else if (r.phone) skipped++;
  }
  if (sentSms > 0) await recordUsage(tenantId, "smsPerTerm", sentSms);
  await db.auditLog.create({ data: { tenantId, actorName: "NEYO Finance Digest", action: `finance.${cadence}_digest_sent`, entityType: "finance", entityId: tenantId, metadata: JSON.stringify({ sentSms, sentInApp, skipped, collectedKes, outstandingKes, openInvoices: invoices.length }) } });
  return { cadence, sentSms, sentInApp, skipped, collectedKes, outstandingKes, openInvoices: invoices.length, recipients: recipients.length, message };
}
