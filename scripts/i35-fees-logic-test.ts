import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { createStudent } from "@/lib/services/student.service";
import { batchInvoice, createManualInvoice, createStructure } from "@/lib/services/finance.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}
async function expectThrows(fn: () => Promise<unknown>, includes: string, label: string) {
  try { await fn(); } catch (e) {
    assert(e instanceof Error && e.message.includes(includes), label);
    return;
  }
  throw new Error(`Expected failure: ${label}`);
}

async function main() {
  console.log("I.35 fees logic test");
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const user = asUser(principalRaw);
  const tenantId = user.tenantId;
  const level = `Grade 99 ${Date.now()}`;
  await db.academicTerm.deleteMany({ where: { tenantId, year: 2099 } });

  await withTenant(tenantId, async () => {
    const cls = await db.schoolClass.create({ data: { tenantId, level, stream: "Blue", curriculum: "CBC" } });
    await db.academicTerm.updateMany({ where: { tenantId }, data: { current: false } });
    await db.academicTerm.create({ data: { tenantId, year: 2099, term: 1, startDate: "2099-01-01", endDate: "2099-04-01", current: true } });

    await createStructure(user, { level, classId: cls.id, year: 2099, term: 1, items: [{ label: "Tuition", amountKes: 12345 }] });

    const created = await createStudent(user, {
      firstName: "Fee",
      lastName: "Tester",
      gender: "M",
      classId: cls.id,
      seedRequirements: false,
      guardians: [],
    } as any);
    const inv = await db.invoice.findFirstOrThrow({ where: { tenantId, studentId: created.id, year: 2099, term: 1, kind: "FEE" } });
    assert(inv.totalKes === 12345 && inv.paidKes === 0 && inv.status === "UNPAID", "new student starts with full exact-class fees owing, not cleared");

    await db.invoice.create({ data: { tenantId, invoiceNo: `TEST-OLD-${Date.now()}`, studentId: created.id, description: "Old term fees", totalKes: 5000, paidKes: 1000, status: "PARTIAL", dueDate: "2099-04-01", year: 2099, term: 1, kind: "FEE" } });
    const struct2 = await createStructure(user, { level, classId: cls.id, year: 2099, term: 2, items: [{ label: "Tuition", amountKes: 15000 }] });
    await batchInvoice(user, struct2.id, "2099-08-01");
    await batchInvoice(user, struct2.id, "2099-08-01");
    const arrears = await db.invoice.findMany({ where: { tenantId, studentId: created.id, year: 2099, term: 2, kind: "ARREARS" } });
    assert(arrears.length === 1 && arrears[0].totalKes >= 4000, "new term carries previous balance once, idempotently");

    await expectThrows(
      () => createManualInvoice(user, { studentId: created.id, description: "Class trip to museum", totalKes: 2000, dueDate: "2099-03-01", year: 2099, term: 1 }),
      "Trips and excursions",
      "trip/excursion cannot be posted as student fee invoice"
    );

    await db.invoice.deleteMany({ where: { tenantId, studentId: created.id } });
    await db.student.delete({ where: { id: created.id } });
    await db.feeItem.deleteMany({ where: { structure: { tenantId, level } } });
    await db.feeStructure.deleteMany({ where: { tenantId, level } });
    await db.academicTerm.deleteMany({ where: { tenantId, year: 2099 } });
    await db.schoolClass.delete({ where: { id: cls.id } });
  });
  console.log("\n✅ I.35 fees logic test passed");
}
main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
