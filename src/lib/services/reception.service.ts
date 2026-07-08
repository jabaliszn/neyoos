/**
 * Receptionist Operations service (A.18).
 * Front-desk workflows: walk-in payments, visitor sign-in/out + badges,
 * admission inquiries, phone-message relay, and a day-end summary.
 * Reuses search (A.11), payments (A.6), messaging (A.8).
 */
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import { createConversation, sendMessage } from "@/lib/services/messaging.service";
import type {
  VisitorSignInInput,
  WalkInPaymentInput,
  AdmissionInquiryInput,
  PhoneMessageInput,
} from "@/lib/validations/reception";

export class ReceptionError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE", message: string) {
    super(message);
    this.name = "ReceptionError";
  }
}

// ---------------------------------------------------------------------------
// A.18.5 — Visitors
// ---------------------------------------------------------------------------

/** Day boundaries in Africa/Nairobi (UTC+3), returned as UTC Date objects. */
function nairobiDayBounds(now = new Date()): { start: Date; end: Date } {
  // Shift to Nairobi, take the date, then build [00:00, 24:00) back in UTC.
  const offsetMs = 3 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const start = new Date(Date.UTC(y, m, d) - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Next badge number for today, e.g. "V-014" (per-tenant, per-day count). */
async function nextBadgeNo(tenantId: string): Promise<string> {
  const { start, end } = nairobiDayBounds();
  const count = await db.visitorLog.count({
    where: { tenantId, signedInAt: { gte: start, lt: end } },
  });
  return `V${count + 1}`;
}

export async function signInVisitor(
  tenantId: string,
  input: VisitorSignInInput,
  createdById: string
) {
  const badgeNo = await nextBadgeNo(tenantId);
  const visitor = await tenantDb().visitorLog.create({
    // tenantId auto-stamped by tenantDb() (A.2 isolation).
    data: {
      name: input.name,
      phone: input.phone ?? null,
      idNumber: input.idNumber ?? null,
      purpose: input.purpose,
      host: input.host ?? null,
      badgeNo,
      createdById,
    } as never,
  });
  return visitor;
}

export async function signOutVisitor(id: string) {
  const v = await tenantDb().visitorLog.findUnique({ where: { id } });
  if (!v) throw new ReceptionError("NOT_FOUND", "Visitor not found.");
  if (v.signedOutAt) return v;
  return tenantDb().visitorLog.update({
    where: { id },
    data: { signedOutAt: new Date() },
  });
}

/** Today's visitors (most recent first). */
export async function todayVisitors() {
  const { start, end } = nairobiDayBounds();
  return tenantDb().visitorLog.findMany({
    where: { signedInAt: { gte: start, lt: end } },
    orderBy: { signedInAt: "desc" },
  });
}

export async function getVisitor(id: string) {
  const v = await tenantDb().visitorLog.findUnique({ where: { id } });
  if (!v) throw new ReceptionError("NOT_FOUND", "Visitor not found.");
  return v;
}

// ---------------------------------------------------------------------------
// A.18.3 — Walk-in payment recording
// ---------------------------------------------------------------------------

/**
 * Record a payment taken at the desk WITHOUT an STK push: cash, M-Pesa already
 * paid, or a bank deposit slip. Marked PAID immediately. Cash gets a synthetic
 * ref so receipts always have one.
 */
export async function recordWalkInPayment(
  tenantId: string,
  input: WalkInPaymentInput,
  actor: { id: string; name: string },
  opts?: { skipBiometricCheck?: boolean }
) {
  // R.3 — real server-side enforcement: if this school has opted into
  // requireBiometricForFinance, a fresh, single-use, server-verified
  // fingerprint/Face ID/passkey ticket for THIS EXACT payment is mandatory
  // — never optional, never skippable by calling the API directly.
  //
  // Deliberate, documented exception: the bulk bank-statement CSV importer
  // (api/reception/bank-import) reconciles money that has ALREADY landed in
  // the school's bank account days earlier — it is not a live cash handover
  // at the counter, and a human cannot practically scan their fingerprint
  // once per CSV row. It passes skipBiometricCheck:true for exactly that
  // reason. The single walk-in payment dialog (cash/M-Pesa/bank-slip typed
  // in one at a time at the desk) is NEVER exempt and always enforces this.
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { requireBiometricForFinance: true } });
  if (tenant?.requireBiometricForFinance && !opts?.skipBiometricCheck) {
    const { cashPaymentActionKey } = await import("@/lib/validations/reception");
    const { consumeBiometricActionTicket } = await import("@/lib/services/passkey.service");
    await consumeBiometricActionTicket(
      actor.id,
      tenantId,
      cashPaymentActionKey({ amount: input.amount, method: input.method, accountRef: input.accountRef }),
      input.biometricTicket
    );
  }

  // Guard against re-entering the same M-Pesa/bank receipt.
  if ((input.method === "mpesa" || input.method === "bank") && input.mpesaRef) {
    const dup = await db.payment.findUnique({ where: { mpesaRef: input.mpesaRef } });
    if (dup) throw new ReceptionError("DUPLICATE", "That payment reference is already recorded.");
  }

  const ref =
    (input.method === "mpesa" || input.method === "bank") && input.mpesaRef
      ? input.mpesaRef
      : `CASH-${Date.now().toString(36).toUpperCase()}`;
  const provider = input.method === "mpesa" ? "mpesa_manual" : input.method === "bank" ? "bank_manual" : "cash";

  const payment = await db.payment.create({
    data: {
      tenantId,
      provider,
      amount: input.amount,
      phone: input.phone,
      accountRef: input.accountRef ?? null,
      description: input.description ?? "Walk-in payment (front desk)",
      status: "PAID",
      mpesaRef: ref,
      paidAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      actorId: actor.id,
      actorName: actor.name,
      action: "payment.walkin",
      entityType: "Payment",
      entityId: payment.id,
      metadata: JSON.stringify({ amount: input.amount, method: input.method, ref }),
    },
  });

  // G.31: receipts print THEMSELVES at the desk — cash included, no tap needed.
  try {
    const { queueReceiptForPayment } = await import("@/lib/services/print-queue.service");
    await queueReceiptForPayment(tenantId, payment.id, `System (${input.method} at desk)`);
  } catch { /* queue is best-effort; payment is already safe */ }

  // R.5 — the receipt lands in the parent's NEYO portal automatically, even
  // if the desk printer never actually prints it (off, station not open,
  // receptionist forgot). Only fires when the payment can genuinely be
  // matched to a real student (via accountRef = their admission number) —
  // never guessed.
  try {
    const { deliverReceiptToPortal } = await import("@/lib/services/receipt-delivery.service");
    await deliverReceiptToPortal(tenantId, payment.id);
  } catch { /* best-effort; payment is already safe */ }

  return payment;
}

// ---------------------------------------------------------------------------
// A.18.6 — Admission inquiries
// ---------------------------------------------------------------------------

export async function captureInquiry(
  tenantId: string,
  input: AdmissionInquiryInput,
  createdById: string
) {
  return tenantDb().admissionInquiry.create({
    data: {
      parentName: input.parentName,
      phone: input.phone,
      studentName: input.studentName ?? null,
      gradeWanted: input.gradeWanted ?? null,
      curriculum: input.curriculum ?? null,
      notes: input.notes ?? null,
      createdById,
    } as never,
  });
}

export async function todayInquiries() {
  const { start, end } = nairobiDayBounds();
  return tenantDb().admissionInquiry.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// A.18.7 — Phone message relay
// ---------------------------------------------------------------------------

/**
 * Take a phone message and relay it into the staff member's inbox via an A.8
 * DIRECT conversation, while keeping the desk's own PhoneMessage log.
 */
export async function relayPhoneMessage(
  tenantId: string,
  input: PhoneMessageInput,
  actor: { id: string; name: string }
) {
  const recipient = await db.user.findFirst({
    where: { id: input.forUserId, tenantId, isActive: true },
    select: { id: true, fullName: true },
  });
  if (!recipient) throw new ReceptionError("NOT_FOUND", "Staff member not found.");

  // Open/reuse a DIRECT conversation and post the message.
  const convo = await createConversation(
    tenantId,
    { id: actor.id, fullName: actor.name },
    { type: "DIRECT", participantIds: [recipient.id] }
  );
  const body = `📞 Phone message from ${input.callerName}${
    input.callerPhone ? ` (${input.callerPhone})` : ""
  }:\n${input.message}`;
  await sendMessage(
    tenantId,
    { id: actor.id, fullName: actor.name },
    { conversationId: convo.id, body }
  );

  const log = await tenantDb().phoneMessage.create({
    data: {
      callerName: input.callerName,
      callerPhone: input.callerPhone ?? null,
      forUserId: recipient.id,
      forUserName: recipient.fullName,
      message: input.message,
      conversationId: convo.id,
      createdById: actor.id,
    } as never,
  });

  return { id: log.id, conversationId: convo.id };
}

export async function todayPhoneMessages() {
  const { start, end } = nairobiDayBounds();
  return tenantDb().phoneMessage.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// A.18.1 / A.18.8 — Dashboard data + day-end summary
// ---------------------------------------------------------------------------

/** Everything the receptionist dashboard needs for "today". */
export async function receptionDashboard(tenantId: string) {
  return withTenant(tenantId, async () => {
    const { start, end } = nairobiDayBounds();
    const tdb = tenantDb();

    const [visitors, inquiries, calls] = await Promise.all([
      tdb.visitorLog.findMany({
        where: { signedInAt: { gte: start, lt: end } },
        orderBy: { signedInAt: "desc" },
      }),
      tdb.admissionInquiry.findMany({
        where: { createdAt: { gte: start, lt: end } },
        orderBy: { createdAt: "desc" },
      }),
      tdb.phoneMessage.findMany({
        where: { createdAt: { gte: start, lt: end } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Payments aren't tenantDb-soft-delete-friendly inside aggregate here, use raw db with tenant filter.
    const payments = await db.payment.findMany({
      where: { tenantId, status: "PAID", paidAt: { gte: start, lt: end }, deletedAt: null },
      orderBy: { paidAt: "desc" },
    });
    const collected = payments.reduce((s, p) => s + p.amount, 0);

    return {
      visitors,
      onSite: visitors.filter((v) => !v.signedOutAt).length,
      inquiries,
      calls,
      payments,
      collected,
    };
  });
}

/** A.18.8 — a structured day-end summary (numbers + lists) for printing. */
export async function dayEndSummary(tenantId: string) {
  const d = await receptionDashboard(tenantId);
  return {
    date: new Date().toISOString().slice(0, 10),
    totals: {
      visitors: d.visitors.length,
      stillOnSite: d.onSite,
      inquiries: d.inquiries.length,
      calls: d.calls.length,
      payments: d.payments.length,
      collectedKes: d.collected,
    },
    visitors: d.visitors,
    inquiries: d.inquiries,
    calls: d.calls,
    payments: d.payments,
  };
}

/** Active staff list for the phone-message recipient picker. */
export async function staffForRelay() {
  return tenantDb().user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });
}
