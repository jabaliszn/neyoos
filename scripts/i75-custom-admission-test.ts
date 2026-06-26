import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { createStudent, listStudents, updateStudent } from "@/lib/services/student.service";
import { createStructure } from "@/lib/services/finance.service";
import { initiateStkPush, handleCallback } from "@/lib/services/payment.service";
import { search } from "@/lib/services/search.service";
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
  console.log("I.75 custom admission numbers test");
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const user = asUser(principalRaw);
  const tenantId = user.tenantId;
  const legacy = `OLD-${Date.now()}`;
  const level = `I75 ${Date.now()}`;

  await withTenant(tenantId, async () => {
    const cls = await db.schoolClass.create({ data: { tenantId, level, stream: "A", curriculum: "CBC" } });
    await db.academicTerm.deleteMany({ where: { tenantId, year: 2097 } });
    await db.academicTerm.updateMany({ where: { tenantId }, data: { current: false } });
    await db.academicTerm.create({ data: { tenantId, year: 2097, term: 1, startDate: "2097-01-01", endDate: "2097-04-01", current: true } });
    await createStructure(user, { level, classId: cls.id, year: 2097, term: 1, items: [{ label: "Tuition", amountKes: 8000 }] });

    const created = await createStudent(user, { firstName: "Legacy", lastName: "Learner", gender: "F", classId: cls.id, legacyAdmissionNo: legacy, seedRequirements: false, guardians: [] } as any);
    const st = await db.student.findUniqueOrThrow({ where: { id: created.id } });
    assert(st.admissionNo !== legacy && st.legacyAdmissionNo === legacy, "student keeps school admission number while NEYO generates its own ID");

    const listHit = await listStudents(user, { q: legacy });
    assert(listHit.some((s) => s.id === st.id), "student list search finds school admission number");
    const globalHit = await search(tenantId, legacy, user);
    assert(globalHit.some((h) => h.type === "student" && h.id === st.id), "global search finds school admission number");

    const invoice = await db.invoice.findFirstOrThrow({ where: { tenantId, studentId: st.id, kind: "FEE" } });
    const payment = await initiateStkPush(tenantId, { amount: 3000, phone: "+254712345678", accountRef: legacy, description: "Legacy admission payment" });
    await handleCallback("mock", { checkoutRequestId: payment.checkoutRequestId, success: true, mpesaRef: `I75${Date.now()}` });
    const paidInvoice = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert(paidInvoice.paidKes === 3000 && paidInvoice.status === "PARTIAL", "M-Pesa callback matches payment by school admission number and applies to invoice");

    const newLegacy = `${legacy}-EDIT`;
    await updateStudent(user, st.id, { legacyAdmissionNo: newLegacy } as any);
    const edited = await db.student.findUniqueOrThrow({ where: { id: st.id } });
    assert(edited.legacyAdmissionNo === newLegacy, "school admission number can be edited safely");

    await db.payment.deleteMany({ where: { tenantId, accountRef: legacy } });
    await db.invoice.deleteMany({ where: { tenantId, studentId: st.id } });
    await db.student.delete({ where: { id: st.id } });
    await db.feeItem.deleteMany({ where: { structure: { tenantId, level } } });
    await db.feeStructure.deleteMany({ where: { tenantId, level } });
    await db.academicTerm.deleteMany({ where: { tenantId, year: 2097 } });
    await db.schoolClass.delete({ where: { id: cls.id } });
  });

  console.log("\n✅ I.75 custom admission numbers test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
