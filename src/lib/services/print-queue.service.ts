/**
 * G.31 Auto-print queue (founder 2026-06-12): invoices/receipts print
 * THEMSELVES at the reception print station.
 *
 * HOW IT WORKS (no special hardware):
 * - Any payment (cash desk, M-Pesa callback) or batch invoicing AUTO-QUEUES
 *   a PrintJob — nobody taps "print".
 * - The reception "Print station" page polls /api/print-queue; while it is
 *   open on the receptionist's computer it fetches each queued PDF and calls
 *   the browser's print dialog to the default printer.
 * - Printer/computer OFF = jobs simply stay QUEUED; the moment the station
 *   page is opened again they flush in order. Class batches group invoices
 *   per class so distribution is one stapled stack per class.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { isPrivilegedPrinter } from "@/lib/services/print-limits.service";
import type { SessionUser } from "@/lib/core/session";

export class PrintError extends Error {
  constructor(public code: "NOT_FOUND" | "ALREADY" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "PrintError";
  }
}

/** Queue one job (server-side helper — callable from payment hooks WITHOUT a session). */
export async function queuePrint(input: {
  tenantId: string;
  kind: "INVOICE" | "RECEIPT" | "CLASS_BATCH";
  refId: string;
  classId?: string | null;
  classLabel?: string | null;
  title: string;
  url: string;
  queuedBy: string;
}) {
  // Dedupe: don't re-queue an identical un-printed job.
  const dup = await db.printJob.findFirst({
    where: { tenantId: input.tenantId, kind: input.kind, refId: input.refId, status: "QUEUED" },
  });
  if (dup) return dup;
  return db.printJob.create({
    data: {
      tenantId: input.tenantId, kind: input.kind, refId: input.refId,
      classId: input.classId ?? null, classLabel: input.classLabel ?? null,
      title: input.title, url: input.url, queuedBy: input.queuedBy,
    },
  });
}

/** Auto-queue an invoice print after a payment (computes balance in the title). */
export async function queueInvoiceAfterPayment(tenantId: string, invoiceId: string, queuedBy: string) {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return;
  const student = await db.student.findUnique({ where: { id: inv.studentId }, include: { schoolClass: true } });
  const balance = inv.totalKes - inv.discountKes - inv.paidKes;
  const classLabel = student?.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null;
  await queuePrint({
    tenantId, kind: "INVOICE", refId: invoiceId,
    classId: student?.classId ?? null, classLabel,
    title: `Invoice ${inv.invoiceNo} — ${student ? `${student.firstName} ${student.lastName}` : "student"} (${inv.status}${balance > 0 ? `, bal KES ${balance.toLocaleString("en-KE")}` : " — PAID IN FULL"})`,
    url: `/api/finance/invoices/${invoiceId}/pdf`,
    queuedBy,
  });
}

/** Auto-queue a receipt after a payment. */
export async function queueReceiptForPayment(tenantId: string, paymentId: string, queuedBy: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  await queuePrint({
    tenantId, kind: "RECEIPT", refId: paymentId,
    title: `Receipt — KES ${payment.amount.toLocaleString("en-KE")} (${payment.mpesaRef ?? payment.provider})`,
    url: `/api/payments/${paymentId}/receipt`,
    queuedBy,
  });
}

/** Queue a CLASS BATCH: every invoice of a class for a structure, one job per invoice grouped by class. */
export async function queueClassBatch(user: SessionUser, structureId: string, classId: string) {
  return withTenant(user.tenantId, async () => {
    const cls = await tenantDb().schoolClass.findUnique({ where: { id: classId } });
    if (!cls) throw new PrintError("NOT_FOUND", "Class not found.");
    const students = await tenantDb().student.findMany({ where: { classId, status: "ACTIVE", deletedAt: null } });
    const invoices = await tenantDb().invoice.findMany({
      where: { structureId, studentId: { in: students.map((s) => s.id) } },
    });
    const label = [cls.level, cls.stream].filter(Boolean).join(" ");
    const sMap = new Map(students.map((s) => [s.id, s]));
    let queued = 0;
    for (const inv of invoices) {
      const st = sMap.get(inv.studentId);
      const balance = inv.totalKes - inv.discountKes - inv.paidKes;
      await queuePrint({
        tenantId: user.tenantId, kind: "INVOICE", refId: inv.id,
        classId, classLabel: label,
        title: `Invoice ${inv.invoiceNo} — ${st ? `${st.firstName} ${st.lastName}` : "student"} (${inv.status}${balance > 0 ? `, bal KES ${balance.toLocaleString("en-KE")}` : ""})`,
        url: `/api/finance/invoices/${inv.id}/pdf`,
        queuedBy: user.fullName,
      });
      queued++;
    }
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "print.class_batch_queued", entityType: "schoolClass", entityId: classId,
        metadata: JSON.stringify({ class: label, queued }),
      },
    });
    return { queued, classLabel: label };
  });
}

/** The station's work list: queued jobs, grouped by class for distribution. */
export async function queuedJobs(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const jobs = await tenantDb().printJob.findMany({
      where: { status: "QUEUED" },
      orderBy: [{ classLabel: "asc" }, { queuedAt: "asc" }],
    });
    const printedToday = await tenantDb().printJob.count({
      where: { status: "PRINTED", printedAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
    });
    // H.2 Boarding Term-End Print Scheduler — the school-wide station mode so the
    // station auto-prints (AUTO) or holds jobs for a term-end batch (HOLD).
    const tenant = await tenantDb().tenant.findUnique({ where: { id: user.tenantId } });
    const printStationMode = tenant?.printStationMode === "HOLD" ? "HOLD" : "AUTO";
    return { jobs, printedToday, printStationMode };
  });
}

/**
 * H.2 Set the school-wide print station mode (AUTO | HOLD). Leadership only.
 * HOLD = boarding schools turn off instant printing; jobs queue and are
 * batch-printed at term end.
 */
export async function setPrintStationMode(user: SessionUser, mode: "AUTO" | "HOLD") {
  return withTenant(user.tenantId, async () => {
    if (!isPrivilegedPrinter(user)) {
      throw new PrintError("FORBIDDEN", "Only the Principal, Deputy, Academics HOD or School Owner can change the print station mode.");
    }
    await db.tenant.update({ where: { id: user.tenantId }, data: { printStationMode: mode } });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "print.station_mode_changed", entityType: "tenant", entityId: user.tenantId,
        metadata: JSON.stringify({ mode }),
      },
    });
    return { printStationMode: mode };
  });
}

/** The station marks a job printed (after the browser print call). */
export async function markPrinted(user: SessionUser, jobId: string) {
  return withTenant(user.tenantId, async () => {
    const job = await tenantDb().printJob.findUnique({ where: { id: jobId } });
    if (!job) throw new PrintError("NOT_FOUND", "Print job not found.");
    if (job.status === "PRINTED") throw new PrintError("ALREADY", "Already printed.");
    return tenantDb().printJob.update({ where: { id: jobId }, data: { status: "PRINTED", printedAt: new Date() } });
  });
}

/** Seam for G.10 external cloud-print / print-shop providers (e.g. cloud print networks). */
export async function sendToExternalPrintShop(user: SessionUser, jobId: string, providerName: string) {
  return withTenant(user.tenantId, async () => {
    const job = await tenantDb().printJob.findUnique({ where: { id: jobId } });
    if (!job) throw new PrintError("NOT_FOUND", "Print job not found.");

    // Simulate API post to external print-shop endpoint (e.g. Print Node, ezeep, or local partner)
    console.log(`\n[EXTERNAL PRINT SHOP → ${providerName}]\nSending print job: ${job.title}\nPDF Url: ${job.url}\nStatus: SENT\n`);

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "print.sent_external", entityType: "PrintJob", entityId: jobId,
        metadata: JSON.stringify({ providerName, jobTitle: job.title }),
      },
    });

    return { success: true, provider: providerName, status: "SENT_TO_SHOP" };
  });
}
