/**
 * R.6 — School Activities / Trips ("Form 4 trip"-style optional
 * fee-collection tracking), full-stack test.
 *
 * The founder's exact real-world scenario (verbatim, distilled):
 *  - a school runs a trip for one or more classes -> every real student in
 *    those classes is added to the roster automatically;
 *  - students who don't pay and get no waiver owe NOTHING, ever;
 *  - a student who pays gets a real, already-PAID invoice — zero balance;
 *  - only an EXPLICIT staff waiver ("parent asked to pay later") creates a
 *    real OPEN balance for that one student — and from then on it behaves
 *    exactly like any other real fee invoice.
 */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import {
  createActivity, listActivities, activityRoster,
  recordActivityPayment, waiveActivityParticipant, unwaiveActivityParticipant,
  SchoolActivityError,
} from "../src/lib/services/school-activity.service";
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
  console.log("R.6 School Activities / Trips — full-stack test");

  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const principal = asUser(principalRaw);
  const tenantId = principal.tenantId;

  const createdActivityIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdPaymentIds: string[] = [];
  let createdClassId: string | null = null;

  try {
    // ------------------------------------------------------------------
    // Part A — creating an activity builds the REAL full roster, and
    // NOBODY on it owes anything by default.
    // ------------------------------------------------------------------
    // A dedicated real class with several real students, so the roster
    // never runs out mid-test across the many real status transitions below
    // (rather than reusing a small pre-existing seeded class).
    const cls = await withTenant(tenantId, () => tenantDb().schoolClass.create({
      data: { level: "R6 Test Grade", stream: `T${Date.now()}` } as never,
    }));
    createdClassId = cls.id;
    for (let i = 0; i < 6; i++) {
      await withTenant(tenantId, () => tenantDb().student.create({
        data: { admissionNo: `R6STU-${Date.now()}-${i}`, firstName: `R6Student${i}`, lastName: "Test", gender: i % 2 === 0 ? "M" : "F", classId: cls.id, status: "ACTIVE" } as never,
      }));
    }
    const classStudents = await withTenant(tenantId, () => tenantDb().student.findMany({ where: { classId: cls.id, status: "ACTIVE" } }));
    assert(classStudents.length === 6, "the dedicated real test class genuinely has all 6 real active students created for this test");

    const activity = await createActivity(principal, {
      name: `R6 Test Trip ${Date.now()}`,
      description: "Test trip", amountKes: 3500, year: 2026, term: 2, classIds: [cls.id],
    });
    createdActivityIds.push(activity.id);
    assert(activity.rosterCount === classStudents.length, "creating the activity built a roster with EVERY real active student in the chosen class — never a partial/opt-in list");

    const beforeInvoiceCount = await db.invoice.count({ where: { tenantId } });

    const roster1 = await activityRoster(principal, activity.id);
    assert(roster1.rows.length === classStudents.length, "the real roster read-back matches the real class roll exactly");
    assert(roster1.rows.every((r) => r.status === "NOT_PAID"), "EVERY student starts as NOT_PAID by default");
    assert(roster1.rows.every((r) => r.balanceKes === 0), "EVERY student genuinely owes ZERO — no invoice, no balance, for anyone who hasn't paid or been waived");
    assert(roster1.rows.every((r) => r.invoiceNo === null), "EVERY student genuinely has NO invoice at all yet — not even a hidden zero-amount one");

    const afterRosterInvoiceCount = await db.invoice.count({ where: { tenantId } });
    assert(afterRosterInvoiceCount === beforeInvoiceCount, "building the roster created ZERO real invoices — confirmed by an actual DB count, not just the API response");

    // ------------------------------------------------------------------
    // Part B — a REAL payment instantly creates an already-PAID invoice —
    // zero balance, cleared to go.
    // ------------------------------------------------------------------
    const payingStudent = roster1.rows[0];
    const payResult = await recordActivityPayment(principal, { participantId: payingStudent.id, method: "cash" });
    createdInvoiceIds.push(payResult.invoiceId);
    createdPaymentIds.push(payResult.paymentId);

    const roster2 = await activityRoster(principal, activity.id);
    const paidRow = roster2.rows.find((r) => r.id === payingStudent.id)!;
    assert(paidRow.status === "PAID", "the paying student's real status genuinely flips to PAID");
    assert(paidRow.balanceKes === 0, "the paying student's real invoice is ALREADY fully paid — zero balance, cleared to go, in the SAME action as paying");
    assert(!!paidRow.invoiceNo, "a real invoice number now genuinely exists for this student");

    const realInvoice = await db.invoice.findUniqueOrThrow({ where: { id: payResult.invoiceId } });
    assert(realInvoice.kind === "ACTIVITY", "the real invoice is correctly tagged kind:ACTIVITY, distinct from compulsory fee invoices");
    assert(realInvoice.status === "PAID" && realInvoice.paidKes === realInvoice.totalKes, "the real invoice row itself (re-queried directly) is genuinely fully paid, not just reported as such");

    await expectThrow(
      "recordActivityPayment is rejected for a student who has already paid (no double-charging)",
      () => recordActivityPayment(principal, { participantId: payingStudent.id, method: "cash" })
    );

    // Every OTHER student on the roster must still owe nothing — a single
    // payment must never leak a balance onto anyone else.
    const othersStillZero = roster2.rows.filter((r) => r.id !== payingStudent.id).every((r) => r.balanceKes === 0 && r.status === "NOT_PAID");
    assert(othersStillZero, "every OTHER student on the roster is completely unaffected — still zero balance, still NOT_PAID");

    // ------------------------------------------------------------------
    // Part C — THE core founder scenario: a parent asks for their child to
    // go WITHOUT paying yet. ONLY NOW does a real OPEN balance get created.
    // ------------------------------------------------------------------
    const waivedStudent = roster2.rows.find((r) => r.status === "NOT_PAID")!;
    const waiveResult = await waiveActivityParticipant(principal, waivedStudent.id, "Parent asked to pay after half-term");
    createdInvoiceIds.push(waiveResult.invoiceId);

    const roster3 = await activityRoster(principal, activity.id);
    const waivedRow = roster3.rows.find((r) => r.id === waivedStudent.id)!;
    assert(waivedRow.status === "WAIVED", "the waived student's real status genuinely flips to WAIVED (going, pay later)");
    assert(waivedRow.balanceKes === 3500, "the waived student now has a REAL open balance for the real activity amount — this is the ONLY way a balance is ever created for a non-paying student");
    assert(!!waivedRow.waivedReason, "the real reason given by staff is genuinely stored");

    const waivedInvoice = await db.invoice.findUniqueOrThrow({ where: { id: waiveResult.invoiceId } });
    assert(waivedInvoice.status === "UNPAID" && waivedInvoice.paidKes === 0, "the real waived invoice is genuinely UNPAID with zero paid — a real, honest open balance");

    // The founder's exact requirement: from this moment this balance is a
    // REAL fee balance — it shows up in the standard arrears/open-invoices
    // machinery exactly like any other B.7 invoice, since it uses the very
    // same Invoice model/status field, not a parallel weaker one.
    const arrearsInvoices = await withTenant(tenantId, () => tenantDb().invoice.findMany({ where: { studentId: waivedStudent.studentId, status: { in: ["UNPAID", "PARTIAL"] } } }));
    assert(arrearsInvoices.some((i) => i.id === waiveResult.invoiceId), "the waived student's activity balance genuinely appears in the SAME real open-invoices/arrears query every other fee balance uses");

    // A student who neither paid nor was waived must STILL owe nothing,
    // even after other students on the roster have real balances.
    const stillUntouchedRow = roster3.rows.find((r) => r.status === "NOT_PAID");
    assert(!!stillUntouchedRow && stillUntouchedRow.balanceKes === 0, "a student who is neither paid nor waived STILL genuinely owes zero, even with other real balances now existing on the same roster");

    await expectThrow(
      "waiveActivityParticipant is rejected for a student who has already paid",
      () => waiveActivityParticipant(principal, payingStudent.id, "test")
    );
    await expectThrow(
      "waiveActivityParticipant is rejected for a student who already has an active waiver (no double-waiving)",
      () => waiveActivityParticipant(principal, waivedStudent.id, "test again")
    );

    // ------------------------------------------------------------------
    // Part D — the waived student can still pay off their real balance
    // later — the SAME real invoice, never a second one.
    // ------------------------------------------------------------------
    const secondPayment = await recordActivityPayment(principal, { participantId: waivedStudent.id, method: "mpesa", mpesaRef: `R6MPESA${Date.now()}` });
    createdPaymentIds.push(secondPayment.paymentId);
    assert(secondPayment.invoiceId === waiveResult.invoiceId, "paying off a waived balance updates the SAME real invoice — never creates a duplicate second one");

    const roster4 = await activityRoster(principal, activity.id);
    const nowPaidRow = roster4.rows.find((r) => r.id === waivedStudent.id)!;
    assert(nowPaidRow.status === "PAID" && nowPaidRow.balanceKes === 0, "after paying off the waived balance, the student's real status is genuinely PAID with zero balance");

    // ------------------------------------------------------------------
    // Part E — undo-waiver guard: cannot silently erase a REAL partial
    // payment; CAN undo a genuinely untouched waiver.
    // ------------------------------------------------------------------
    const secondWaivedStudent = roster4.rows.find((r) => r.status === "NOT_PAID")!;
    const secondWaive = await waiveActivityParticipant(principal, secondWaivedStudent.id, "Testing undo");
    createdInvoiceIds.push(secondWaive.invoiceId);

    await unwaiveActivityParticipant(principal, secondWaivedStudent.id);
    const roster5 = await activityRoster(principal, activity.id);
    const undoneRow = roster5.rows.find((r) => r.id === secondWaivedStudent.id)!;
    assert(undoneRow.status === "NOT_PAID" && undoneRow.balanceKes === 0, "undoing a genuinely untouched waiver correctly returns the student to NOT_PAID / zero balance");
    const deletedInvoice = await db.invoice.findUnique({ where: { id: secondWaive.invoiceId } });
    assert(deletedInvoice === null, "undoing the waiver genuinely deleted the real invoice row — confirmed by direct DB re-query, not just the API response");
    createdInvoiceIds.splice(createdInvoiceIds.indexOf(secondWaive.invoiceId), 1);

    // Now prove undo is REFUSED once real money has touched the balance.
    const partialPayStudent = roster5.rows.find((r) => r.status === "NOT_PAID" && r.id !== secondWaivedStudent.id)!;
    const partialWaive = await waiveActivityParticipant(principal, partialPayStudent.id, "Testing partial-payment guard");
    createdInvoiceIds.push(partialWaive.invoiceId);
    const partialPayment = await recordActivityPayment(principal, { participantId: partialPayStudent.id, amountKes: 1000, method: "cash" });
    createdPaymentIds.push(partialPayment.paymentId);
    // A partial payment on a WAIVED invoice keeps it WAIVED (not yet fully PAID).
    const rosterPartial = await activityRoster(principal, activity.id);
    const partialRow = rosterPartial.rows.find((r) => r.id === partialPayStudent.id)!;
    assert(partialRow.balanceKes === 2500, "a real partial payment on a waived balance correctly reduces it, but a genuine balance remains");
    await expectThrow(
      "unwaiveActivityParticipant is REFUSED once real money has been applied — never a silent data-erasing shortcut",
      () => unwaiveActivityParticipant(principal, partialPayStudent.id)
    );

    // ------------------------------------------------------------------
    // Part F — the activities list shows real, correct aggregate stats.
    // ------------------------------------------------------------------
    const list = await listActivities(principal);
    const listedActivity = list.find((a) => a.id === activity.id)!;
    assert(listedActivity.paidCount >= 2, "the activities list shows a real, correct paid-count aggregate");
    assert(listedActivity.outstandingKes > 0, "the activities list shows a real, correct outstanding-balance aggregate (from the still-open waived invoices)");

    console.log("\n\u2705 R.6 School Activities / Trips test passed");
  } finally {
    if (createdPaymentIds.length) await db.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    if (createdInvoiceIds.length) await db.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
    for (const activityId of createdActivityIds) {
      await db.activityParticipant.deleteMany({ where: { activityId } });
      await db.schoolActivityClass.deleteMany({ where: { activityId } });
    }
    if (createdActivityIds.length) await db.schoolActivity.deleteMany({ where: { id: { in: createdActivityIds } } });
    if (createdClassId) {
      await db.student.deleteMany({ where: { classId: createdClassId } });
      await db.schoolClass.deleteMany({ where: { id: createdClassId } });
    }

    const remainingActivities = await db.schoolActivity.count({ where: { id: { in: createdActivityIds } } });
    const remainingParticipants = await db.activityParticipant.count({ where: { activityId: { in: createdActivityIds } } });
    const remainingInvoices = await db.invoice.count({ where: { id: { in: createdInvoiceIds } } });
    const remainingPayments = await db.payment.count({ where: { id: { in: createdPaymentIds } } });
    const remainingClass = createdClassId ? await db.schoolClass.count({ where: { id: createdClassId } }) : 0;
    if (remainingActivities > 0 || remainingParticipants > 0 || remainingInvoices > 0 || remainingPayments > 0 || remainingClass > 0) {
      throw new Error("CLEANUP FAILED: some test rows were not actually removed (re-queried DB directly)");
    }
    console.log("  cleanup \u2713 (test activity, roster rows, invoices, payments removed — confirmed via direct DB re-query)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
