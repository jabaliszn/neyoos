/** B.7+ founder requests — live tests. */
import { db } from "../src/lib/db";
import { studentOpenInvoices, stkForInvoice, buildInvoicePdf } from "../src/lib/services/finance.service";
import { handleCallback } from "../src/lib/services/payment.service";
import { verifyDocument } from "../src/lib/services/document.service";
import { can } from "../src/lib/core/permissions";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) { return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser; }

async function main() {
  const receptionist = await asUser("frontdesk@karibuhigh.ac.ke").catch(() => null) ?? await (async () => {
    const u = await db.user.findFirstOrThrow({ where: { role: "RECEPTIONIST", tenant: { slug: "karibu-high" } } });
    return u as unknown as SessionUser;
  })();
  console.log("receptionist:", receptionist.fullName, "| has record_payment:", can("RECEPTIONIST", "finance.record_payment") ? "✓" : "✗", "| reception.operate:", can("RECEPTIONIST", "reception.operate") ? "✓" : "✗");

  // 1) desk flow: find Kamau's open invoices
  const kamau = await db.student.findFirstOrThrow({ where: { firstName: "Kamau" } });
  const { invoices: open, hasFeeInvoices } = await studentOpenInvoices(receptionist, kamau.id);
  console.log("open invoices:", open.length, open[0]?.invoiceNo, "bal", open[0]?.balanceKes, open.length >= 1 ? "✓" : "✗");
  console.log("hasFeeInvoices (R.2 no-invoice-vs-cleared signal):", hasFeeInvoices ? "✓ true (this student has real invoice history)" : "✗");

  // 2) receptionist STK 2000 on it -> mock callback PAID -> ledger applied
  const stk = await stkForInvoice(receptionist, open[0].id, "0733221100", 2000);
  await handleCallback("mock", { mock: true, success: true, checkoutRequestId: (await db.payment.findUniqueOrThrow({ where: { id: stk.paymentId } })).checkoutRequestId, mpesaRef: "DESK" + Date.now().toString(36).toUpperCase() });
  const after = await db.invoice.findUniqueOrThrow({ where: { id: open[0].id } });
  console.log("desk STK applied:", after.paidKes === 15000 + 2000 ? "✓ 17,000 paid" : "✗ " + after.paidKes);

  // 3) print tracking: 2 prints -> copy numbers + audit + badge data
  const before = after.printCount;
  const p1 = await buildInvoicePdf(receptionist, open[0].id);
  console.log("print 1:", p1.pdf.subarray(0, 4).toString() === "%PDF" ? "✓ PDF" : "✗");
  await buildInvoicePdf(receptionist, open[0].id);
  const tracked = await db.invoice.findUniqueOrThrow({ where: { id: open[0].id } });
  console.log("print count:", tracked.printCount, tracked.printCount === before + 2 ? "✓ +2" : "✗");
  console.log("lastPrintedBy:", tracked.lastPrintedBy === receptionist.fullName ? "✓ " + tracked.lastPrintedBy : "✗");
  const audits = await db.auditLog.count({ where: { action: "finance.invoice_printed", entityId: open[0].id } });
  console.log("print audits:", audits >= 2 ? "✓ " + audits : "✗");
  const v = await verifyDocument((await db.documentVerification.findFirstOrThrow({ where: { docType: "fee_invoice" }, orderBy: { createdAt: "desc" } })).code);
  console.log("invoice QR verify:", v?.valid ? "✓ " + v.summary.slice(0, 50) : "✗");

  // cleanup: revert payment + print stamps
  await db.invoice.update({ where: { id: open[0].id }, data: { paidKes: 15000, status: "PARTIAL", printCount: 0, lastPrintedAt: null, lastPrintedBy: null } });
  await db.payment.delete({ where: { id: stk.paymentId } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
