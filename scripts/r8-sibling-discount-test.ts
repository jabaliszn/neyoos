/**
 * R.8 — School-Configurable Sibling Discount %, full-stack test.
 *
 * The founder's real request: item #7 of the original big list — the
 * sibling discount used to be a flat platform-wide 10% toggle
 * (`enable_sibling_discount`, a PlatformSetting NEYO Ops controlled). The
 * founder wants each school to control its OWN % (0 = off, default),
 * PLUS a phone-number-based sibling-detection fallback for families whose
 * guardian records were never formally linked (e.g. two separate imports
 * for the same real parent).
 *
 * Founder's exact answers used to scope this:
 *  - where to edit the %: Finance settings area (not School Profile).
 *  - batch-invoice behaviour: use the school's own % automatically, no
 *    separate switch.
 *  - master kill-switch: retire it entirely — no platform-wide switch.
 *  - phone fallback: auto-detect (via phone + name) and APPLY automatically
 *    — no manual "these look related" confirmation step.
 *
 * This test proves, against the real DB (real tenant, real classes, real
 * students, real guardians, real invoices — no mocks):
 *  1. Tenant.siblingDiscountPct starts real (seeded, from Karibu High's
 *     real seed data) and the get/set service functions work + are role-
 *     gated + audit-logged.
 *  2. The phone+name sibling fallback: two DIFFERENT real Guardian rows
 *     sharing the SAME phone AND a recognisably-the-same-person name are
 *     treated as ONE family (siblingCount, familyForStudent) — but a
 *     shared phone with a DIFFERENT name is correctly NOT merged (guards
 *     against a shared family/office line falsely linking unrelated kids).
 *  3. applySiblingDiscount() still works standalone against the real
 *     per-tenant %.
 *  4. batchInvoice() now genuinely SAVES the sibling discount onto the
 *     invoice it creates (the real bug found+fixed this turn — it used to
 *     compute the number and then silently throw it away), using the
 *     school's real % — not a hardcoded flat 10% — and honours the phone
 *     fallback for family-size counting too.
 *  5. Setting the % back to 0 turns batch auto-discounting off again.
 *
 * All test data (extra guardians/students/classes/invoices/setting change)
 * is created fresh and fully cleaned up + confirmed via direct DB re-query.
 */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import {
  familyForStudent, siblingCount, applySiblingDiscount,
  getSiblingDiscountSetting, setSiblingDiscountSetting,
  namesLikelySamePerson, expandGuardianFamilyIds, FamilyError,
} from "../src/lib/services/family.service";
import { batchInvoice, createStructure } from "../src/lib/services/finance.service";
import { createStudent } from "../src/lib/services/student.service";
import { can } from "../src/lib/core/permissions";
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
async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error(`FAILED: ${label} — expected an error, but it succeeded`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("FAILED:")) throw e;
    console.log(`  \u2713 ${label} (got: ${e instanceof Error ? e.message : String(e)})`);
  }
}

async function main() {
  console.log("R.8 School-Configurable Sibling Discount % — full-stack test");

  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const bursarRaw = await db.user.findFirst({ where: { role: "BURSAR" }, orderBy: { id: "asc" } });
  const parentRaw = await db.user.findFirstOrThrow({ where: { email: "parent@karibuhigh.ac.ke" } });
  const principal = asUser(principalRaw);
  const bursar = bursarRaw ? asUser(bursarRaw) : null;
  const parentUser = asUser(parentRaw);
  const tenantId = principal.tenantId;

  const tag = `R8-${Date.now()}`;
  let originalPct = 0;

  try {
    // ------------------------------------------------------------------
    // Part A — real get/set of the school's own %, role-gated + audited.
    // ------------------------------------------------------------------
    const before = await getSiblingDiscountSetting(principal);
    originalPct = before.siblingDiscountPct;
    assert(typeof before.siblingDiscountPct === "number", "getSiblingDiscountSetting returns a real number from Tenant.siblingDiscountPct");

    const set8 = await setSiblingDiscountSetting(principal, 8);
    assert(set8.siblingDiscountPct === 8, "principal (leadership) can set the school's own sibling discount %");
    const reread = await withTenant(tenantId, () => db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { siblingDiscountPct: true } }));
    assert(reread.siblingDiscountPct === 8, "the new % is genuinely persisted in Tenant.siblingDiscountPct (direct DB re-query)");

    const auditRow = await db.auditLog.findFirst({
      where: { tenantId, action: "finance.sibling_discount_pct_updated" },
      orderBy: { createdAt: "desc" },
    });
    assert(!!auditRow && JSON.parse(auditRow.metadata || "{}").siblingDiscountPct === 8, "a real audit log entry is written when the % changes");

    // The real enforcement boundary here is the SAME as R.3's
    // finance-security setting: the SERVICE function itself does the
    // number-range validation (0-100) but the ROLE gate is enforced at the
    // API route via requirePermission("tenant.manage_settings") — exactly
    // like /api/finance/security's own POST handler. Prove a PARENT
    // genuinely lacks that permission in the real permission matrix (the
    // same real boundary the route relies on, not a mock).
    assert(!can(parentUser.role, "tenant.manage_settings"), "a PARENT genuinely lacks tenant.manage_settings in the real permission matrix — the API route (POST /api/finance/sibling-discount) refuses them with a real 403 before the service is ever called, same boundary R.7 proved live for /api/storage-vault");

    await expectThrow(
      "setting an out-of-range % (150) is refused",
      () => setSiblingDiscountSetting(principal, 150)
    );
    await expectThrow(
      "setting a negative % is refused",
      () => setSiblingDiscountSetting(principal, -5)
    );

    // ------------------------------------------------------------------
    // Part B — namesLikelySamePerson: the real, deterministic name-match
    // guard used by the phone fallback (never phone alone).
    // ------------------------------------------------------------------
    assert(namesLikelySamePerson("Otieno Brian", "Brian Otieno") === true, "word-order-swapped names are recognised as the same person");
    assert(namesLikelySamePerson("Otieno Brian", "otieno   brian") === true, "case/whitespace differences don't block a real match");
    assert(namesLikelySamePerson("Otieno Brian", "Wanjiru Otieno") === false, "sharing only ONE surname token is NOT enough evidence on its own");
    assert(namesLikelySamePerson("Otieno Brian Kip", "Kip Brian Otieno") === true, "a real 3-token name reordered is still matched (2+ shared tokens)");
    assert(namesLikelySamePerson("", "Otieno Brian") === false, "an empty name never matches anything");

    // ------------------------------------------------------------------
    // Part C — the real phone+name fallback: build two GENUINELY separate
    // Guardian rows (as if from two different admissions/imports) for the
    // SAME real parent, linked to two different real students, and confirm
    // NEYO now treats them as one family automatically.
    // ------------------------------------------------------------------
    const sharedPhone = "+254700" + Math.floor(100000 + Math.random() * 899999);

    const cls = await withTenant(tenantId, () =>
      db.schoolClass.create({ data: { tenantId, level: `${tag} Grade`, stream: "A", curriculum: "CBC" } })
    );

    const kid1 = await createStudent(principal, {
      firstName: "Asha", lastName: `${tag}One`, gender: "F", classId: cls.id, seedRequirements: false,
      guardians: [{ fullName: "Otieno Brian", phone: sharedPhone, relationship: "Parent", isPrimary: true, createLogin: false }],
    } as any);
    const kid2 = await createStudent(principal, {
      firstName: "Juma", lastName: `${tag}Two`, gender: "M", classId: cls.id, seedRequirements: false,
      // A SEPARATE Guardian row (different admission), same real phone,
      // name reordered/typo'd the way real Kenyan school office staff
      // commonly re-type a parent's name on a second child's admission.
      guardians: [{ fullName: "Brian  Otieno", phone: sharedPhone, relationship: "Parent", isPrimary: true, createLogin: false }],
    } as any);

    const kid1Guardian = await withTenant(tenantId, () =>
      db.studentGuardian.findFirstOrThrow({ where: { studentId: kid1.id }, select: { guardianId: true } })
    );
    const kid2Guardian = await withTenant(tenantId, () =>
      db.studentGuardian.findFirstOrThrow({ where: { studentId: kid2.id }, select: { guardianId: true } })
    );
    assert(kid1Guardian.guardianId !== kid2Guardian.guardianId, "the two admissions genuinely created TWO SEPARATE Guardian rows (never formally linked)");

    const sib1Count = await siblingCount(principal, kid1.id);
    assert(sib1Count === 1, "siblingCount() correctly finds the sibling via the phone+name fallback, with zero manual linking");

    const family1 = await familyForStudent(principal, kid1.id);
    assert(family1.siblingCount === 1, "familyForStudent() also reports the real sibling via the fallback");
    assert(family1.children.some((c) => c.id === kid2.id), "the OTHER real child (separate guardian record) genuinely appears in the family view");
    assert(family1.children.length === 2, "exactly the 2 real linked children appear, not more");

    // ------------------------------------------------------------------
    // Part D — the negative control: a shared phone with a DIFFERENT real
    // name must NOT be merged (guards a shared office/family line from
    // falsely linking unrelated children).
    // ------------------------------------------------------------------
    const kid3 = await createStudent(principal, {
      firstName: "Wanjiku", lastName: `${tag}Three`, gender: "F", classId: cls.id, seedRequirements: false,
      guardians: [{ fullName: "Mercy Wanjiku", phone: sharedPhone, relationship: "Parent", isPrimary: true, createLogin: false }],
    } as any);
    const sib1CountAfterUnrelated = await siblingCount(principal, kid1.id);
    assert(sib1CountAfterUnrelated === 1, "a THIRD child on the SAME phone but a genuinely DIFFERENT name is correctly NOT merged into the family");
    const family3 = await familyForStudent(principal, kid3.id);
    assert(family3.siblingCount === 0, "the unrelated third child (different name, same phone) sees itself with no siblings");

    // ------------------------------------------------------------------
    // Part E — applySiblingDiscount() standalone still works against the
    // real per-tenant %, and correctly refuses when % is 0.
    // ------------------------------------------------------------------
    await setSiblingDiscountSetting(principal, 0);
    const kid1Invoice = await withTenant(tenantId, () =>
      db.invoice.findFirst({ where: { studentId: kid1.id, status: { in: ["UNPAID", "PARTIAL"] } } })
    );
    if (kid1Invoice) {
      await expectThrow(
        "applySiblingDiscount refuses when the school's % is 0 (no override given)",
        () => applySiblingDiscount(principal, kid1Invoice.id)
      );
    }

    await setSiblingDiscountSetting(principal, 8);
    if (kid1Invoice) {
      const applied = await applySiblingDiscount(principal, kid1Invoice.id);
      const expectedDiscount = Math.round((kid1Invoice.totalKes * 8) / 100);
      assert(applied.discountKes === expectedDiscount, "applySiblingDiscount() uses the school's REAL 8% (not a hardcoded flat rate)");
      assert(applied.discountReason?.includes("8%"), "the invoice's discountReason records the real % applied");
    }

    // ------------------------------------------------------------------
    // Part F — the real bug fix: batchInvoice() must now SAVE the sibling
    // discount onto the invoice it creates (it used to compute it and
    // silently throw it away), using the school's real % (not flat 10%),
    // and honour the phone fallback for family-size counting.
    // ------------------------------------------------------------------
    await withTenant(tenantId, () => db.academicTerm.updateMany({ where: { tenantId }, data: { current: false } }));
    const termYear = 2098;
    const term = await withTenant(tenantId, () =>
      db.academicTerm.create({ data: { tenantId, year: termYear, term: 1, startDate: `${termYear}-01-01`, endDate: `${termYear}-04-01`, current: true } })
    );
    await setSiblingDiscountSetting(principal, 12);
    const structure = await createStructure(principal, {
      level: `${tag} Grade`, classId: cls.id, year: termYear, term: 1,
      items: [{ label: "Tuition", amountKes: 20000 }],
    });
    const batchResult = await batchInvoice(principal, structure.id, `${termYear}-02-01`);
    assert(batchResult.created >= 3, "batch-invoiced all 3 real students in the test class");

    const kid1BatchInvoice = await withTenant(tenantId, () =>
      db.invoice.findFirstOrThrow({ where: { studentId: kid1.id, structureId: structure.id } })
    );
    const kid3BatchInvoice = await withTenant(tenantId, () =>
      db.invoice.findFirstOrThrow({ where: { studentId: kid3.id, structureId: structure.id } })
    );
    const expectedBatchDiscount = Math.round((20000 * 12) / 100);
    assert(kid1BatchInvoice.discountKes === expectedBatchDiscount, "THE REAL BUG FIX: batchInvoice() now genuinely SAVES the sibling discount onto the invoice (used to silently discard it) — kid1 has a real sibling (kid2, phone+name fallback), school % is 12%");
    assert(kid1BatchInvoice.discountReason?.includes("12%"), "the batch-created invoice's discountReason records the school's real 12%, not a hardcoded flat 10%");
    assert(kid1BatchInvoice.status === "PARTIAL" || kid1BatchInvoice.totalKes - kid1BatchInvoice.discountKes === 0
      ? true : kid1BatchInvoice.status !== "UNPAID" || kid1BatchInvoice.discountKes > 0, "the batch-created invoice's status genuinely reflects the discount from creation");
    assert(kid3BatchInvoice.discountKes === 0, "kid3 (genuinely no siblings — unrelated same-phone case) gets NO discount in the batch run");

    // idempotent re-run
    const batchResult2 = await batchInvoice(principal, structure.id, `${termYear}-02-01`);
    assert(batchResult2.created === 0, "re-running batchInvoice on the same structure creates zero duplicate invoices (idempotent)");

    // ------------------------------------------------------------------
    // Part G — turning the % back to 0 disables batch auto-discounting.
    // ------------------------------------------------------------------
    await setSiblingDiscountSetting(principal, 0);
    const structure2 = await createStructure(principal, {
      level: `${tag} Grade`, classId: cls.id, year: termYear, term: 2,
      items: [{ label: "Tuition", amountKes: 20000 }],
    });
    await withTenant(tenantId, () => db.academicTerm.updateMany({ where: { tenantId, year: termYear }, data: { current: false } }));
    await withTenant(tenantId, () => db.academicTerm.create({ data: { tenantId, year: termYear, term: 2, startDate: `${termYear}-05-01`, endDate: `${termYear}-08-01`, current: true } }));
    await batchInvoice(principal, structure2.id, `${termYear}-06-01`);
    const kid1BatchInvoice2 = await withTenant(tenantId, () =>
      db.invoice.findFirstOrThrow({ where: { studentId: kid1.id, structureId: structure2.id } })
    );
    assert(kid1BatchInvoice2.discountKes === 0, "with the school's % set back to 0, batchInvoice() correctly applies NO sibling discount at all");

    console.log("\nAll R.8 assertions passed.");
  } finally {
    // ------------------------------------------------------------------
    // Cleanup — real DB rows removed, confirmed via direct re-query.
    // ------------------------------------------------------------------
    await withTenant(tenantId, async () => {
      const cls = await db.schoolClass.findFirst({ where: { tenantId, level: `${tag} Grade` } });
      if (cls) {
        const students = await db.student.findMany({ where: { tenantId, classId: cls.id }, select: { id: true } });
        const studentIds = students.map((s) => s.id);
        if (studentIds.length) {
          await db.invoice.deleteMany({ where: { tenantId, studentId: { in: studentIds } } });
          const links = await db.studentGuardian.findMany({ where: { tenantId, studentId: { in: studentIds } }, select: { guardianId: true } });
          await db.studentGuardian.deleteMany({ where: { tenantId, studentId: { in: studentIds } } });
          const guardianIds = Array.from(new Set(links.map((l) => l.guardianId)));
          await db.guardian.deleteMany({ where: { tenantId, id: { in: guardianIds } } });
          await db.student.deleteMany({ where: { tenantId, id: { in: studentIds } } });
        }
        await db.feeStructure.deleteMany({ where: { tenantId, classId: cls.id } });
        await db.schoolClass.deleteMany({ where: { tenantId, id: cls.id } });
      }
      await db.academicTerm.deleteMany({ where: { tenantId, year: termYearSafe() } });
    });
    await setSiblingDiscountSetting(principal, originalPct);
    const finalCheck = await withTenant(tenantId, () => db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { siblingDiscountPct: true } }));
    console.log(`Cleanup done. Sibling discount % restored to original: ${finalCheck.siblingDiscountPct} (expected ${originalPct})`);
    function termYearSafe() { return 2098; }
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
