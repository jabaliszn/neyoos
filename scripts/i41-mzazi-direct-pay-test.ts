import { db } from "@/lib/db";
import { mzaziPay, buildMzaziCardPdf } from "@/lib/services/mzazi.service";
import { handleCallback } from "@/lib/services/payment.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}
async function main() {
  console.log("I.41 Mzazi QR direct pay test");
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const open = await db.invoice.findFirstOrThrow({
    where: { tenantId: principal.tenantId, status: { in: ["UNPAID", "PARTIAL"] } },
    orderBy: { dueDate: "asc" },
  });
  const student = await db.student.findUniqueOrThrow({
    where: { id: open.studentId },
    include: { guardians: { include: { guardian: true } } },
  });
  const guardianPhone = student.guardians[0]?.guardian.phone;
  assert(Boolean(guardianPhone), "student has guardian phone for QR challenge");

  await buildMzaziCardPdf(principal, student.id);
  const crypto = await import("crypto");
  const payloadHash = crypto.createHash("sha256").update(`mzazi:${principal.tenantId}:${student.id}`).digest("hex");
  const rec = await db.documentVerification.findFirstOrThrow({ where: { tenantId: principal.tenantId, docType: "mzazi_card", payloadHash } });
  const beforePaid = open.paidKes;
  const amount = 100;

  const pay = await mzaziPay(rec.code, guardianPhone!, amount);
  assert(Boolean(pay.checkoutRequestId), "Mzazi QR pay sends direct STK checkout request");
  assert(pay.accountRef === (student.legacyAdmissionNo ?? student.admissionNo).slice(0, 20), "STK account ref uses school admission number when available, else NEYO number");

  await handleCallback("mock", { checkoutRequestId: pay.checkoutRequestId, success: true, mpesaRef: `I41${Date.now()}` });
  const after = await db.invoice.findUniqueOrThrow({ where: { id: open.id } });
  assert(after.paidKes === beforePaid + amount, "successful M-Pesa callback applies QR payment to the correct invoice");

  await db.invoice.update({ where: { id: open.id }, data: { paidKes: beforePaid, status: open.status } });
  await db.payment.deleteMany({ where: { tenantId: principal.tenantId, checkoutRequestId: pay.checkoutRequestId } });

  console.log("\n✅ I.41 Mzazi QR direct pay test passed");
}
main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
