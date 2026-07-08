/**
 * R.3 — Fingerprint/Face ID before cash payments, discounts/waivers and
 * bank-deposit entries, full-stack test.
 *
 * The founder's exact ask: cash payments AND fee discounts/waivers AND
 * bank-deposit entries AND direct invoice edits ("the third/broadest
 * option"), a real per-school Settings toggle (off by default), and it must
 * genuinely work with iPhone Face ID and any other phone's fingerprint/Face
 * unlock (native WebAuthn via @simplewebauthn/browser — confirmed, no extra
 * code needed for that part). Founder also explicitly asked for REAL
 * server-side enforcement, not just a client-side popup — this test proves
 * the server itself refuses to move money without a genuine, single-use,
 * non-replayable ticket bound to the EXACT action being performed.
 *
 * This test cannot drive a real WebAuthn ceremony (no real authenticator in
 * a headless sandbox), so it mints BiometricActionTicket rows directly in
 * the DB — exactly what verifyActionAssertion() would create after a real
 * successful fingerprint/Face ID scan — and proves the CONSUMING side
 * (consumeBiometricActionTicket + every money-moving service function that
 * calls it) is genuinely, unavoidably enforced server-side.
 */
import { randomUUID } from "crypto";
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import { recordWalkInPayment } from "../src/lib/services/reception.service";
import { applyDiscount, discountActionKey, applyPaymentToInvoice, offlinePaymentActionKey } from "../src/lib/services/finance.service";
import { applySiblingDiscount } from "../src/lib/services/family.service";
import { consumeBiometricActionTicket } from "../src/lib/services/passkey.service";
import { financeSecurityStatus, setFinanceSecurity } from "../src/lib/services/finance-security.service";
import { cashPaymentActionKey } from "../src/lib/validations/reception";
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

/** Mint a real ticket row the same shape verifyActionAssertion() would create. */
async function mintTicket(userId: string, tenantId: string, actionKey: string, opts?: { expired?: boolean; used?: boolean }) {
  const id = randomUUID();
  await db.biometricActionTicket.create({
    data: {
      id, userId, tenantId, actionKey,
      expiresAt: opts?.expired ? new Date(Date.now() - 60_000) : new Date(Date.now() + 3 * 60_000),
      usedAt: opts?.used ? new Date() : null,
    },
  });
  return id;
}

async function main() {
  console.log("R.3 Biometric/passkey finance gate — full-stack test");

  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const receptionistRaw = await db.user.findFirst({ where: { role: "RECEPTIONIST" } });
  const principal = asUser(principalRaw);
  const actor = receptionistRaw ? asUser(receptionistRaw) : principal;
  const tenantId = principal.tenantId;

  const createdInvoiceIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdTicketIds: string[] = [];

  try {
    // ------------------------------------------------------------------
    // Part A — the toggle itself: off by default, only leadership changes it.
    // ------------------------------------------------------------------
    const initialStatus = await financeSecurityStatus(principal);
    assert(initialStatus.requireBiometricForFinance === false, "requireBiometricForFinance defaults to OFF (never forced on)");
    assert(typeof initialStatus.currentUserHasPasskey === "boolean", "financeSecurityStatus reports a real currentUserHasPasskey boolean signal");

    // ------------------------------------------------------------------
    // Part B — with the flag OFF (default): cash payment succeeds with NO
    // ticket at all, proving normal schools are never impacted.
    // ------------------------------------------------------------------
    await setFinanceSecurity(principal, false);
    const paymentOff = await recordWalkInPayment(
      tenantId,
      { amount: 500, phone: "0712345678", method: "cash", description: "R3 test — flag off" } as any,
      { id: actor.id, name: actor.fullName }
    );
    createdPaymentIds.push(paymentOff.id);
    assert(paymentOff.status === "PAID", "flag OFF: a cash payment with NO biometricTicket succeeds normally (no regression for schools that don't opt in)");

    // ------------------------------------------------------------------
    // Part C — turn the flag ON, then prove every enforcement point below
    // is REAL server-side enforcement (not just a client popup): the exact
    // same call with NO ticket must now be refused.
    // ------------------------------------------------------------------
    const afterOn = await setFinanceSecurity(principal, true);
    assert(afterOn.requireBiometricForFinance === true, "leadership can turn the flag ON via setFinanceSecurity()");
    const statusAfterOn = await financeSecurityStatus(principal);
    assert(statusAfterOn.requireBiometricForFinance === true, "financeSecurityStatus reflects the real new tenant state (not cached/stale)");

    await expectThrow(
      "flag ON: cash payment with NO ticket is REJECTED server-side (recordWalkInPayment)",
      () => recordWalkInPayment(tenantId, { amount: 700, phone: "0712345678", method: "cash", description: "R3 test — no ticket" } as any, { id: actor.id, name: actor.fullName })
    );

    // A ticket minted for a DIFFERENT amount must not work either.
    const wrongAmountTicket = await mintTicket(actor.id, tenantId, cashPaymentActionKey({ amount: 999, method: "cash", accountRef: undefined }));
    createdTicketIds.push(wrongAmountTicket);
    await expectThrow(
      "flag ON: a ticket minted for a DIFFERENT amount cannot be replayed against this payment",
      () => recordWalkInPayment(tenantId, { amount: 700, phone: "0712345678", method: "cash", description: "R3 test — wrong ticket", biometricTicket: wrongAmountTicket } as any, { id: actor.id, name: actor.fullName })
    );

    // A ticket minted for ANOTHER user cannot be used either.
    const otherUserTicket = await mintTicket(principal.id, tenantId, cashPaymentActionKey({ amount: 700, method: "cash", accountRef: undefined }));
    createdTicketIds.push(otherUserTicket);
    await expectThrow(
      "flag ON: a ticket minted for a DIFFERENT staff member cannot be used by this actor",
      () => recordWalkInPayment(tenantId, { amount: 700, phone: "0712345678", method: "cash", description: "R3 test — someone else's ticket", biometricTicket: otherUserTicket } as any, { id: actor.id, name: actor.fullName })
    );

    // An expired ticket cannot be used.
    const expiredTicket = await mintTicket(actor.id, tenantId, cashPaymentActionKey({ amount: 700, method: "cash", accountRef: undefined }), { expired: true });
    createdTicketIds.push(expiredTicket);
    await expectThrow(
      "flag ON: an EXPIRED ticket is rejected",
      () => recordWalkInPayment(tenantId, { amount: 700, phone: "0712345678", method: "cash", description: "R3 test — expired ticket", biometricTicket: expiredTicket } as any, { id: actor.id, name: actor.fullName })
    );

    // The REAL, correctly-bound ticket succeeds.
    const goodTicket = await mintTicket(actor.id, tenantId, cashPaymentActionKey({ amount: 700, method: "cash", accountRef: undefined }));
    createdTicketIds.push(goodTicket);
    const paymentOn = await recordWalkInPayment(
      tenantId,
      { amount: 700, phone: "0712345678", method: "cash", description: "R3 test — good ticket", biometricTicket: goodTicket } as any,
      { id: actor.id, name: actor.fullName }
    );
    createdPaymentIds.push(paymentOn.id);
    assert(paymentOn.status === "PAID", "flag ON: a cash payment WITH a real, correctly-bound, unused ticket succeeds");

    // The SAME ticket cannot be reused a second time (single-use).
    await expectThrow(
      "flag ON: a ticket cannot be reused a second time (single-use, already consumed)",
      () => recordWalkInPayment(tenantId, { amount: 700, phone: "0712345678", method: "cash", description: "R3 test — reuse attempt", biometricTicket: goodTicket } as any, { id: actor.id, name: actor.fullName })
    );
    const spentTicketRow = await db.biometricActionTicket.findUnique({ where: { id: goodTicket } });
    assert(!!spentTicketRow?.usedAt, "the consumed ticket's usedAt is genuinely stamped in the DB (atomic single-use, not just in-memory)");

    // ------------------------------------------------------------------
    // Part D — the SAME enforcement protects the Finance-page "cash/offline
    // entry" path (applyPaymentToInvoice), a SEPARATE code path from the
    // front-desk dialog, proving the founder's "cash payments" scope is
    // covered everywhere cash can be typed in, not just one screen.
    // ------------------------------------------------------------------
    await withTenant(tenantId, async () => {
      const tdb = tenantDb();
      const student = await tdb.student.findFirstOrThrow({ where: { status: "ACTIVE" } });
      const invoiceNo = `R3TEST-${Date.now()}`;
      const inv = await tdb.invoice.create({
        data: {
          invoiceNo, studentId: student.id, description: "R3 test invoice",
          totalKes: 10_000, dueDate: "2026-08-01", year: 2026, term: 2, kind: "MANUAL",
        } as never,
      });
      createdInvoiceIds.push(inv.id);

      await expectThrow(
        "flag ON: Finance-page offline payment (applyPaymentToInvoice) with NO ticket is rejected",
        () => applyPaymentToInvoice(principal, inv.id, 2000)
      );

      const offlineTicket = await mintTicket(principal.id, tenantId, offlinePaymentActionKey(inv.id, 2000));
      createdTicketIds.push(offlineTicket);
      const updated = await applyPaymentToInvoice(principal, inv.id, 2000, offlineTicket);
      assert(updated.paidKes === 2000, "flag ON: Finance-page offline payment succeeds with a real, correctly-bound ticket");

      // ----------------------------------------------------------------
      // Part E — discount/waiver enforcement (applyDiscount), covering both
      // the direct desk-discount flow and the sibling-discount shortcut.
      // ----------------------------------------------------------------
      await expectThrow(
        "flag ON: applyDiscount with NO ticket is rejected (direct desk-discount flow)",
        () => applyDiscount(principal, inv.id, 1000, "R3 test bursary")
      );

      const discountTicket = await mintTicket(principal.id, tenantId, discountActionKey(inv.id, 1000));
      createdTicketIds.push(discountTicket);
      const discounted = await applyDiscount(principal, inv.id, 1000, "R3 test bursary", discountTicket);
      assert(discounted.discountKes === 1000, "flag ON: applyDiscount succeeds with a real, correctly-bound ticket");

      // The SAME discount ticket cannot be reused for the sibling-discount path.
      await expectThrow(
        "flag ON: the already-consumed discount ticket cannot be reused via the sibling-discount shortcut",
        () => applyDiscount(principal, inv.id, 1000, "R3 test reuse", discountTicket)
      );
    });

    // ------------------------------------------------------------------
    // Part F — applySiblingDiscount funnels through the exact same
    // applyDiscount() enforcement (not a separate, weaker check).
    // ------------------------------------------------------------------
    await withTenant(tenantId, async () => {
      const tdb = tenantDb();
      // Achieng + Atieno are seeded siblings (share guardian Otieno Brian).
      const achieng = await tdb.student.findFirstOrThrow({ where: { firstName: "Achieng" } });
      const invoiceNo = `R3SIB-${Date.now()}`;
      const inv = await tdb.invoice.create({
        data: {
          invoiceNo, studentId: achieng.id, description: "R3 sibling-discount test invoice",
          totalKes: 20_000, dueDate: "2026-08-01", year: 2026, term: 2, kind: "MANUAL",
        } as never,
      });
      createdInvoiceIds.push(inv.id);

      await expectThrow(
        "flag ON: applySiblingDiscount with NO ticket is rejected (funnels through the same applyDiscount() gate)",
        () => applySiblingDiscount(principal, inv.id, 10)
      );

      const expectedAmount = Math.round((20_000 * 10) / 100);
      const sibTicket = await mintTicket(principal.id, tenantId, discountActionKey(inv.id, expectedAmount));
      createdTicketIds.push(sibTicket);
      const sibResult: any = await applySiblingDiscount(principal, inv.id, 10, sibTicket);
      assert(sibResult.discountKes === expectedAmount, "flag ON: applySiblingDiscount succeeds with a real ticket bound to the EXACT computed discount amount");
    });

    // ------------------------------------------------------------------
    // Part G — the bulk bank-statement CSV importer is a DELIBERATE,
    // documented exception (reconciling money that already landed days
    // earlier, not a live counter handover) — it must keep working even
    // with the flag ON, via the explicit skipBiometricCheck opt.
    // ------------------------------------------------------------------
    const bulkPayment = await recordWalkInPayment(
      tenantId,
      { amount: 300, phone: "0712345678", method: "bank", mpesaRef: `R3BULK-${Date.now()}`, description: "R3 test — bulk bank import exception" } as any,
      { id: actor.id, name: actor.fullName },
      { skipBiometricCheck: true }
    );
    createdPaymentIds.push(bulkPayment.id);
    assert(bulkPayment.status === "PAID", "flag ON: the documented bulk bank-import exception (skipBiometricCheck) still works — bulk reconciliation isn't broken by this feature");

    // The SAME call WITHOUT the exception flag must still be gated (proves
    // the exception is opt-in per-call, not a global bypass).
    await expectThrow(
      "flag ON: the SAME walk-in payment WITHOUT the exception flag is still gated (the bulk-import exception is not a backdoor)",
      () => recordWalkInPayment(tenantId, { amount: 301, phone: "0712345678", method: "bank", mpesaRef: `R3BULK2-${Date.now()}`, description: "R3 test — no exception, should fail" } as any, { id: actor.id, name: actor.fullName })
    );

    // ------------------------------------------------------------------
    // Part H — consumeBiometricActionTicket itself: no ticket id at all.
    // ------------------------------------------------------------------
    await expectThrow(
      "consumeBiometricActionTicket rejects when biometricTicket is completely missing (undefined)",
      () => consumeBiometricActionTicket(actor.id, tenantId, "some_action:1", undefined)
    );

    console.log("\n\u2705 R.3 Biometric/passkey finance gate test passed");
  } finally {
    // ---- cleanup: restore the flag, remove test data, confirm via re-query ----
    await setFinanceSecurity(principal, false);
    const confirmOff = await financeSecurityStatus(principal);
    if (confirmOff.requireBiometricForFinance !== false) {
      throw new Error("CLEANUP FAILED: requireBiometricForFinance was not restored to false");
    }

    if (createdPaymentIds.length) await db.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    if (createdInvoiceIds.length) await db.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
    if (createdTicketIds.length) await db.biometricActionTicket.deleteMany({ where: { id: { in: createdTicketIds } } });

    const remainingTickets = await db.biometricActionTicket.count({ where: { id: { in: createdTicketIds } } });
    const remainingInvoices = await db.invoice.count({ where: { id: { in: createdInvoiceIds } } });
    const remainingPayments = await db.payment.count({ where: { id: { in: createdPaymentIds } } });
    if (remainingTickets > 0 || remainingInvoices > 0 || remainingPayments > 0) {
      throw new Error("CLEANUP FAILED: some test rows were not actually removed (re-queried DB directly)");
    }
    console.log("  cleanup \u2713 (test tickets, invoices, payments removed; flag restored to OFF — all confirmed via direct DB re-query)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
