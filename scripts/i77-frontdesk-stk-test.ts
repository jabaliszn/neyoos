import { db } from "@/lib/db";
import { stkForInvoice } from "@/lib/services/finance.service";
import { nextTenantId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { permissionsForRole } from "@/lib/core/permissions";
import { readFileSync } from "node:fs";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.77 front-desk M-Pesa STK to parent test");
  const receptionist = asUser(await db.user.findFirstOrThrow({ where: { email: "frontoffice@karibuhigh.ac.ke" } }));
  const perms = permissionsForRole(receptionist.role);
  assert(perms.includes("reception.operate") && perms.includes("finance.record_payment"), "receptionist role can operate front desk and record payments");

  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: receptionist.tenantId, archived: false } });
  const admissionNo = await nextTenantId(receptionist.tenantId, "STUDENT");
  const student = await db.student.create({ data: { tenantId: receptionist.tenantId, admissionNo, firstName: "Ivy", lastName: "Wairimu", gender: "F", classId: cls.id, status: "ACTIVE" } });
  const invoiceNo = await nextTenantId(receptionist.tenantId, "INVOICE");
  const invoice = await db.invoice.create({ data: { tenantId: receptionist.tenantId, invoiceNo, studentId: student.id, description: "I.77 front desk test fees", totalKes: 2500, paidKes: 0, status: "UNPAID", dueDate: "2099-08-01", year: 2099, term: 2 } });

  try {
    const result = await stkForInvoice(receptionist, invoice.id, "0712345678", 1200);
    assert(Boolean(result.paymentId && result.checkoutRequestId), "front desk can initiate a real pending STK push through the payment service");
    const payment = await db.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    assert(payment.invoiceId === invoice.id && payment.status === "PENDING" && payment.amount === 1200, "STK payment is linked to the selected invoice and pending callback");
    assert(payment.phone === "0712345678" && payment.accountRef === invoice.invoiceNo, "STK prompt is sent to the parent's phone with the invoice account reference");
    const audit = await db.auditLog.findFirst({ where: { tenantId: receptionist.tenantId, action: "finance.stk_initiated", entityId: invoice.id }, orderBy: { createdAt: "desc" } });
    assert(Boolean(audit), "front-desk STK initiation is audit logged");
  } finally {
    await db.payment.deleteMany({ where: { invoiceId: invoice.id } });
    await db.invoice.deleteMany({ where: { id: invoice.id } });
    await db.student.deleteMany({ where: { id: student.id } });
  }

  const route = readFileSync("src/app/api/reception/fees/route.ts", "utf8");
  assert(route.includes('requirePermission("reception.operate")') && route.includes('requirePermission("finance.record_payment")') && route.includes("stkForInvoice"), "front desk fees API is permission-gated and calls the invoice STK service");
  const ui = readFileSync("src/components/reception/reception-desk.tsx", "utf8");
  assert(ui.includes("M-Pesa fees") && ui.includes("Collect fees via M-Pesa") && ui.includes("Parent's M-Pesa phone") && ui.includes("Send STK push"), "front desk UI exposes the M-Pesa fees STK workflow");
  assert(ui.includes("Works on ANY phone with an M-Pesa line"), "front desk copy explains parent SIM-toolkit PIN prompt clearly");

  console.log("\n✅ I.77 front-desk M-Pesa STK to parent test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
