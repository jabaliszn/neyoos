/**
 * R.2 — "brand-new student shows fees cleared" bug fix, full-stack test.
 *
 * The real bug: `feeBalanceKes === 0` was rendered identically whether a
 * student's REAL invoices are all genuinely paid off (a real "cleared"
 * state), or the student has had ZERO invoices ever raised (e.g. no fee
 * structure configured yet for their class/term) — a fundamentally
 * different, honest "not billed yet" state that the founder correctly
 * flagged as confusing/misleading.
 *
 * Fix: every fee-position-reporting function (`parent-portal.service.ts`'s
 * `myChildren`, `family.service.ts`'s `familyForStudent`, and
 * `finance.service.ts`'s `studentOpenInvoices` used by the front-desk STK
 * dialog and the QR payment-lookup station) now also returns a real
 * `hasFeeInvoices` (or per-item) boolean computed from an ACTUAL invoice
 * count — never a guess — so the UI can render a genuinely distinct
 * "no fees billed yet" state instead of a misleading "cleared".
 */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import { myChildren } from "../src/lib/services/parent-portal.service";
import { familyForStudent } from "../src/lib/services/family.service";
import { studentOpenInvoices } from "../src/lib/services/finance.service";
import type { SessionUser } from "../src/lib/core/session";
import type { Role } from "../src/lib/core/roles";

function asUser(u: any): SessionUser {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  \u2713 ${message}`);
}

async function main() {
  console.log("R.2 'fees cleared' honesty bug — full-stack test");
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const parentRaw = await db.user.findFirstOrThrow({ where: { email: "parent@karibuhigh.ac.ke" } });
  const principal = asUser(principalRaw);
  const parent = asUser(parentRaw);
  const tenantId = principal.tenantId;

  const createdStudentIds: string[] = [];
  const createdGuardianIds: string[] = [];

  try {
    await withTenant(tenantId, async () => {
      const tdb = tenantDb();
      const cls = await tdb.schoolClass.findFirstOrThrow({ where: { archived: false } });

      // ---- Student A: genuinely NEVER billed (zero invoices ever) ----
      const neverBilled = await tdb.student.create({
        data: { admissionNo: `R2-NEVER-${Date.now()}`, firstName: "Amani", lastName: "Kiptoo", gender: "M", classId: cls.id } as never,
      });
      createdStudentIds.push(neverBilled.id);

      // ---- Student B: genuinely fully paid (a real invoice, real full payment) ----
      const fullyPaid = await tdb.student.create({
        data: { admissionNo: `R2-PAID-${Date.now()}`, firstName: "Zainab", lastName: "Mwikali", gender: "F", classId: cls.id } as never,
      });
      createdStudentIds.push(fullyPaid.id);
      const invoiceNo = `R2-INV-${Date.now()}`;
      await tdb.invoice.create({
        data: {
          invoiceNo, studentId: fullyPaid.id, description: "Term fees", totalKes: 10000, paidKes: 10000,
          discountKes: 0, status: "PAID", kind: "FEE", dueDate: "2026-12-31", year: 2026, term: 2,
        } as never,
      });

      // ---- 1. finance.service.ts's studentOpenInvoices (front desk / QR station) ----
      const neverBilledOpen = await studentOpenInvoices(principal, neverBilled.id);
      assert(neverBilledOpen.invoices.length === 0, "never-billed student genuinely has zero open invoices");
      assert(neverBilledOpen.hasFeeInvoices === false, "studentOpenInvoices HONESTLY reports hasFeeInvoices:false for a student with NO invoice history at all");

      const fullyPaidOpen = await studentOpenInvoices(principal, fullyPaid.id);
      assert(fullyPaidOpen.invoices.length === 0, "fully-paid student also has zero OPEN invoices (same raw signal as never-billed)");
      assert(fullyPaidOpen.hasFeeInvoices === true, "studentOpenInvoices correctly distinguishes: this student DOES have real invoice history (just fully settled)");

      // ---- 2. family.service.ts's familyForStudent (Student Profile 'Family' card) ----
      // Link both test students to the same guardian so they show up together as a real family.
      const guardian = await tdb.guardian.create({ data: { fullName: "Test Guardian R2", phone: "+254799333444" } as never });
      createdGuardianIds.push(guardian.id);
      await tdb.studentGuardian.create({ data: { studentId: neverBilled.id, guardianId: guardian.id, relationship: "Parent", isPrimary: true } as never });
      await tdb.studentGuardian.create({ data: { studentId: fullyPaid.id, guardianId: guardian.id, relationship: "Parent", isPrimary: true } as never });

      const family = await familyForStudent(principal, neverBilled.id);
      const neverBilledCard = family.children.find((c) => c.id === neverBilled.id)!;
      const fullyPaidCard = family.children.find((c) => c.id === fullyPaid.id)!;
      assert(neverBilledCard.hasFeeInvoices === false, "family card: never-billed sibling honestly shows hasFeeInvoices:false");
      assert(fullyPaidCard.hasFeeInvoices === true, "family card: fully-paid sibling honestly shows hasFeeInvoices:true");
      assert(neverBilledCard.balanceKes === 0 && fullyPaidCard.balanceKes === 0, "both siblings show a numeric balance of 0 — proving the OLD code could not tell them apart without the new flag");
    });

    // ---- 3. parent-portal.service.ts's myChildren (Parent Portal home) ----
    // The seeded parent's real linked child (Achieng) already has real fee
    // history from the seed data — verify the portal reports it honestly
    // either way (whichever real state it's actually in).
    const children = await myChildren(parent);
    assert(children.length > 0, "the real seeded parent has at least one real linked child to check");
    for (const c of children) {
      assert(typeof c.hasFeeInvoices === "boolean", `myChildren reports a real boolean hasFeeInvoices for ${c.name} (not undefined/missing)`);
    }

    console.log("\n\u2705 R.2 'fees cleared' honesty bug test passed");
  } finally {
    await withTenant(tenantId, async () => {
      const tdb = tenantDb();
      for (const id of createdStudentIds) {
        await tdb.invoice.deleteMany({ where: { studentId: id } }).catch(() => {});
        await tdb.studentGuardian.deleteMany({ where: { studentId: id } }).catch(() => {});
        await db.student.delete({ where: { id } }).catch(() => {});
      }
      for (const id of createdGuardianIds) {
        await tdb.guardian.delete({ where: { id } }).catch(() => {});
      }
    });
    console.log("  cleanup \u2713 (test students, guardian, invoice removed)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
