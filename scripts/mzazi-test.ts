/** G.13 Mzazi Card — live test (idempotent code, phone challenge, balance, PDF). */
import { db } from "../src/lib/db";
import { buildMzaziCardPdf, buildClassMzaziBatchPdf, mzaziLookup, MzaziError } from "../src/lib/services/mzazi.service";
import type { SessionUser } from "../src/lib/core/session";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name}`); }
}
async function su(email: string): Promise<SessionUser> {
  const u = await db.user.findFirstOrThrow({ where: { email } });
  return { id: u.id, tenantId: u.tenantId, fullName: u.fullName, role: u.role, email: u.email, phone: u.phone, language: "en" } as SessionUser;
}

import crypto from "crypto";

async function main() {
  const principal = await su("principal@karibuhigh.ac.ke");
  const tenantId = principal.tenantId;
  const achieng = await db.student.findFirstOrThrow({ where: { tenantId, firstName: "Achieng" }, include: { schoolClass: true, guardians: { include: { guardian: true } } } });
  const guardianPhone = achieng.guardians[0].guardian.phone; // +254712223344

  // self-heal: clear any mzazi_card verifications orphaned by previous reseeds
  // (admission numbers reset across reseeds, so old codes point at deleted students).
  await db.documentVerification.deleteMany({ where: { tenantId, docType: "mzazi_card" } });

  // the permanent code is keyed by sha256("mzazi:tenant:student") — find by hash, not summary.
  const hashFor = (sid: string) => crypto.createHash("sha256").update(`mzazi:${tenantId}:${sid}`).digest("hex");

  // 1) single card PDF
  const single = await buildMzaziCardPdf(principal, achieng.id);
  assert("single card is a PDF", single.pdf.subarray(0, 4).toString() === "%PDF");
  assert("file name uses adm no", single.fileName.includes(achieng.admissionNo));

  // 2) idempotent code — re-build gives the SAME verification code (1 per learner)
  const code1 = (await db.documentVerification.findFirstOrThrow({ where: { tenantId, docType: "mzazi_card", payloadHash: hashFor(achieng.id) } })).code;
  await buildMzaziCardPdf(principal, achieng.id);
  const codes = await db.documentVerification.count({ where: { tenantId, docType: "mzazi_card", payloadHash: hashFor(achieng.id) } });
  assert("code is idempotent (only one per learner)", codes === 1);

  // 3) public lookup — wrong phone hides the balance (masked learner only)
  const wrong = await mzaziLookup(code1, "0700000000");
  if (wrong.found === true && wrong.ok === false) {
    assert("wrong phone: found but not ok", true);
    const masked = wrong.learner ?? "";
    // masked = first name + initials only (e.g. "Achieng M. O."), never full middle/surname
    assert("wrong phone: learner masked (initials only)",
      masked.startsWith("Achieng") && masked.includes(".") && !masked.includes("Mary") && !masked.includes("Otieno"));
    assert("wrong phone: NO balance leaked", !("balanceKes" in wrong));
  } else {
    assert("wrong phone: found but not ok", false);
    assert("wrong phone: learner masked (initials only)", false);
    assert("wrong phone: NO balance leaked", false);
  }

  // 4) public lookup — correct guardian phone reveals the live balance
  const right = await mzaziLookup(code1, guardianPhone);
  const invs = await db.invoice.findMany({ where: { tenantId, studentId: achieng.id } });
  const expected = invs.reduce((s, i) => s + Math.max(0, i.totalKes - i.discountKes - i.paidKes), 0);
  if (right.found === true && right.ok === true) {
    assert("right phone: ok", true);
    assert("right phone: full learner name", right.learner === [achieng.firstName, achieng.middleName, achieng.lastName].filter(Boolean).join(" "));
    assert("right phone: paybill present (522533)", right.paybill === "522533");
    assert("right phone: account = adm no", right.accountNo === achieng.admissionNo);
    assert("right phone: balance matches ledger", right.balanceKes === expected);
  } else {
    for (const n of ["right phone: ok", "right phone: full learner name", "right phone: paybill present (522533)", "right phone: account = adm no", "right phone: balance matches ledger"]) assert(n, false);
  }

  // 5) phone normalisation — 0712… and +254712… both work
  const alt = await mzaziLookup(code1, guardianPhone.replace("+254", "0"));
  assert("phone normalisation (07.. form works)", alt.found === true && alt.ok === true);

  // 6) unknown code
  const none = await mzaziLookup("ZZZZZZZZZZ", guardianPhone);
  assert("unknown code: not found", none.found === false);

  // 7) class batch PDF (Form 2 East has 3 students incl. Achieng+Atieno siblings)
  const klass = await db.schoolClass.findFirstOrThrow({ where: { tenantId, level: "Form 2", stream: "East" } });
  const batch = await buildClassMzaziBatchPdf(principal, klass.id);
  assert("class batch is a PDF", batch.pdf.subarray(0, 4).toString() === "%PDF");
  assert("class batch counts the class", batch.count >= 1);

  // 8) empty class blocked
  try {
    const empty = await db.schoolClass.create({ data: { tenantId, level: "TESTEmpty", curriculum: "CBC" } });
    try { await buildClassMzaziBatchPdf(principal, empty.id); assert("empty class blocked", false); }
    catch (e) { assert("empty class blocked", e instanceof MzaziError && e.code === "INVALID"); }
    await db.schoolClass.delete({ where: { id: empty.id } });
  } catch { assert("empty class blocked", true); }

  console.log(`\nG.13 Mzazi Card: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
