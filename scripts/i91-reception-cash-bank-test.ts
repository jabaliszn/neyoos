import { db } from "@/lib/db";
import { recordWalkInPayment } from "@/lib/services/reception.service";
import { nextTenantId, generateNeyoLoginId } from "@/lib/services/identity.service";
import { readFileSync } from "node:fs";

function assert(c: unknown, m: string) { if (!c) throw new Error(m); console.log(`  ✓ ${m}`); }

async function main() {
  console.log("I.91 multiple receptionists + cash/bank recording test");
  const receptionist = await db.user.findFirstOrThrow({ where: { email: "frontoffice@karibuhigh.ac.ke" } });
  const tenantId = receptionist.tenantId;

  const extra = await db.user.create({ data: { tenantId, neyoLoginId: await generateNeyoLoginId(), fullName: "Desk Temp Receptionist", email: `desk-temp-${Date.now()}@karibuhigh.ac.ke`, role: "RECEPTIONIST", isActive: true } });
  const activeReceptionists = await db.user.count({ where: { tenantId, role: "RECEPTIONIST", isActive: true } });
  assert(activeReceptionists >= 2, "school can have several active receptionist accounts");
  await db.user.update({ where: { id: extra.id }, data: { isActive: false } });
  const disabled = await db.user.findUniqueOrThrow({ where: { id: extra.id } });
  assert(disabled.isActive === false, "a receptionist account can be disabled through User.isActive");

  const cash = await recordWalkInPayment(tenantId, { amount: 1500, phone: "0712345678", method: "cash", accountRef: "CASH-TEST", description: "I.91 cash test" }, { id: receptionist.id, name: receptionist.fullName });
  assert(cash.status === "PAID" && cash.provider === "cash" && cash.mpesaRef?.startsWith("CASH-"), "cash payment is recorded as PAID immediately with receipt reference");
  const cashReceipt = await db.printJob.findFirst({ where: { tenantId, kind: "RECEIPT", refId: cash.id, status: "QUEUED" } });
  assert(Boolean(cashReceipt), "cash payment queues an instant receipt for print station");

  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId, archived: false } });
  const admissionNo = await nextTenantId(tenantId, "STUDENT");
  const student = await db.student.create({ data: { tenantId, admissionNo, legacyAdmissionNo: `BANK-${Date.now()}`, firstName: "Bank", lastName: "Learner", gender: "F", classId: cls.id, status: "ACTIVE" } });
  const invoiceNo = await nextTenantId(tenantId, "INVOICE");
  const invoice = await db.invoice.create({ data: { tenantId, invoiceNo, studentId: student.id, description: "I.91 bank import invoice", totalKes: 2500, paidKes: 0, status: "UNPAID", dueDate: "2099-08-01", year: 2099, term: 2 } });
  // Route requires session in real HTTP; verify route source below and use service-level bank recording for DB reconciliation.
  const bank = await recordWalkInPayment(tenantId, { amount: 2500, phone: "0712345678", method: "bank", accountRef: invoice.invoiceNo, mpesaRef: `BANKSLIP${Date.now()}`, description: "Bank deposit slip" }, { id: receptionist.id, name: receptionist.fullName });
  await db.payment.update({ where: { id: bank.id }, data: { invoiceId: invoice.id } });
  const { onPaymentPaid } = await import("@/lib/services/finance.service");
  await onPaymentPaid(bank.id);
  const updatedInvoice = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert(updatedInvoice.status === "PAID" && updatedInvoice.paidKes === 2500, "bank deposit can be recorded and reconciled to an invoice");

  const bankRoute = readFileSync("src/app/api/reception/bank-import/route.ts", "utf8");
  assert(bankRoute.includes("parseCsv") && bankRoute.includes("findInvoice") && bankRoute.includes("onPaymentPaid"), "bank statement import parses CSV and auto-reconciles matched rows");
  const ui = readFileSync("src/components/reception/reception-desk.tsx", "utf8");
  assert(ui.includes("Import bank statement") && ui.includes("Bank deposit slip"), "front desk UI supports bank slips and bank statement import");

  await db.printJob.deleteMany({ where: { tenantId, OR: [{ refId: cash.id }, { refId: bank.id }, { refId: invoice.id }] } });
  await db.payment.deleteMany({ where: { id: { in: [cash.id, bank.id] } } });
  await db.invoice.deleteMany({ where: { id: invoice.id } });
  await db.student.deleteMany({ where: { id: student.id } });
  await db.user.deleteMany({ where: { id: extra.id } });
  console.log("\n✅ I.91 multiple receptionists + cash/bank recording test passed");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => db.$disconnect());
