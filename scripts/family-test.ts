/** G.12 Sibling Intelligence — live test (SELF-HEALS the test discount). */
import { db } from "../src/lib/db";
import { familyForStudent, siblingCount, applySiblingDiscount, FamilyError } from "../src/lib/services/family.service";
import type { SessionUser } from "../src/lib/core/session";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name}`); }
}
async function su(email: string): Promise<SessionUser> {
  const u = await db.user.findFirstOrThrow({ where: { email } });
  return { id: u.id, tenantId: u.tenantId, fullName: u.fullName, role: u.role, email: u.email, phone: u.phone, language: "en" } as SessionUser;
}

async function main() {
  const principal = await su("principal@karibuhigh.ac.ke");
  const tenantId = principal.tenantId;

  const achieng = await db.student.findFirstOrThrow({ where: { tenantId, firstName: "Achieng" } });
  const atieno = await db.student.findFirstOrThrow({ where: { tenantId, firstName: "Atieno" } });
  const kamau = await db.student.findFirstOrThrow({ where: { tenantId, firstName: "Kamau" } }); // only-child in seed

  // 1) siblingCount
  assert("Achieng has 1 sibling", (await siblingCount(principal, achieng.id)) === 1);
  assert("Atieno has 1 sibling", (await siblingCount(principal, atieno.id)) === 1);
  assert("Kamau has 0 siblings", (await siblingCount(principal, kamau.id)) === 0);

  // 2) family view from Achieng's side
  const fam = await familyForStudent(principal, achieng.id);
  assert("family view: siblingCount = 1", fam.siblingCount === 1);
  assert("family view: 2 children listed", fam.children.length === 2);
  assert("family view: current child flagged", fam.children.some((c) => c.isCurrent && c.id === achieng.id));
  assert("family view: includes Atieno", fam.children.some((c) => c.name.includes("Atieno")));
  assert("family view: combined balance = sum of kids", fam.combinedBalanceKes === fam.children.reduce((s, c) => s + c.balanceKes, 0));
  assert("family view: shared guardian present", fam.guardians.some((g) => g.fullName.includes("Otieno")));
  assert("family view: tenant sibling discount = 5%", fam.siblingDiscountPct === 5);

  // 3) symmetry — same family from Atieno's side
  const fam2 = await familyForStudent(principal, atieno.id);
  assert("symmetry: Atieno sees Achieng too", fam2.children.length === 2 && fam2.children.some((c) => c.name.includes("Achieng")));

  // 4) only-child view
  const famK = await familyForStudent(principal, kamau.id);
  assert("only-child: siblingCount 0", famK.siblingCount === 0);
  assert("only-child: just the one child", famK.children.length === 1 && famK.children[0].isCurrent);

  // 5) sibling discount seam — apply to one of Atieno's unpaid invoices
  const inv = await db.invoice.findFirst({ where: { tenantId, studentId: atieno.id } });
  if (inv) {
    const before = inv.discountKes;
    const expected = Math.round((inv.totalKes * 5) / 100);
    const updated = await applySiblingDiscount(principal, inv.id); // uses tenant 5%
    assert("sibling discount = 5% of total", updated.discountKes === before + expected);
    assert("discount reason recorded", (updated.discountReason ?? "").includes("Sibling discount (5%)"));
    // self-heal: restore the invoice's original discount/status
    await db.invoice.update({ where: { id: inv.id }, data: { discountKes: before, discountReason: null, status: inv.status } });
  } else {
    assert("sibling discount = 5% of total (skipped — no invoice)", true);
    assert("discount reason recorded (skipped)", true);
  }

  // 6) cannot apply to an only-child's invoice
  const invK = await db.invoice.findFirst({ where: { tenantId, studentId: kamau.id } });
  if (invK) {
    try { await applySiblingDiscount(principal, invK.id); assert("only-child invoice blocked", false); }
    catch (e) { assert("only-child invoice blocked", e instanceof FamilyError && e.code === "INVALID"); }
  } else {
    assert("only-child invoice blocked (skipped — no invoice)", true);
  }

  // 7) over-100 / unknown invoice handled
  try { await applySiblingDiscount(principal, "nope-id"); assert("unknown invoice 404", false); }
  catch (e) { assert("unknown invoice 404", e instanceof FamilyError && e.code === "NOT_FOUND"); }

  console.log(`\nG.12 Sibling Intelligence: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
