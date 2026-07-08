/**
 * R.6 — School Activities / Trips ("Form 4 trip"-style optional
 * fee-collection tracking).
 *
 * Founder's exact real-world specification (verbatim, distilled):
 *  - When a school runs an activity/trip for one or more classes (e.g.
 *    "Grade 1 to Grade 3"), EVERY real student in those classes is added to
 *    the roster automatically — never a separate "who's coming" opt-in step.
 *  - A student who neither pays nor gets an explicit waiver owes NOTHING —
 *    no invoice, no balance, completely invisible in Finance/arrears, EVER.
 *  - The moment a real payment is actually collected, a real Invoice is
 *    created for that ONE student — already fully paid, zero balance —
 *    proof they're cleared to go.
 *  - If a parent asks for their child to go WITHOUT paying yet (a genuine
 *    promise/waiver request), staff records that explicitly. ONLY from that
 *    moment does a real Invoice with a REAL open balance exist for that
 *    student — and from then on it is a completely normal fee balance:
 *    shows in Finance arrears, gets fee reminders, can carry a real
 *    promise-to-pay date — exactly like any other B.7 invoice, on purpose,
 *    reusing the SAME real finance machinery rather than inventing a
 *    parallel, weaker one.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { nextTenantId } from "@/lib/services/identity.service";
import { recordWalkInPayment } from "@/lib/services/reception.service";
import { cashPaymentActionKey } from "@/lib/validations/reception";
import type { SessionUser } from "@/lib/core/session";

/**
 * R.3 — recordActivityPayment() below calls the REAL recordWalkInPayment(),
 * which (when the school has requireBiometricForFinance on) verifies a
 * ticket against `cashPaymentActionKey({amount, method, accountRef})` — the
 * SAME real key every other cash payment at NEYO is gated by, never a
 * separate, weaker check invented just for activities. The UI must request
 * its biometric ticket bound to EXACTLY this key (student.admissionNo is
 * always the real accountRef an activity payment is recorded under — see
 * recordActivityPayment() below).
 */
export function activityPaymentActionKey(amountKes: number, method: "cash" | "mpesa" | "bank", studentAdmissionNo: string): string {
  return cashPaymentActionKey({ amount: amountKes, method, accountRef: studentAdmissionNo });
}

export class SchoolActivityError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "ALREADY", message: string) {
    super(message);
    this.name = "SchoolActivityError";
  }
}

async function audit(user: SessionUser, action: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType: "SchoolActivity", entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

/**
 * Create a real activity + build its full real roster from every ACTIVE
 * student in the chosen classes — every row starts NOT_PAID with NO
 * invoice, exactly as specified.
 */
export async function createActivity(
  user: SessionUser,
  input: { name: string; description?: string; amountKes: number; year: number; term: number; eventDate?: string; classIds: string[] }
) {
  return withTenant(user.tenantId, async () => {
    const classes = await tenantDb().schoolClass.findMany({ where: { id: { in: input.classIds }, archived: false } });
    if (classes.length === 0) throw new SchoolActivityError("NOT_FOUND", "None of the chosen classes were found.");

    const students = await tenantDb().student.findMany({
      where: { classId: { in: classes.map((c) => c.id) }, status: "ACTIVE" },
      select: { id: true },
    });

    const activity = await tenantDb().schoolActivity.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        amountKes: input.amountKes,
        year: input.year,
        term: input.term,
        eventDate: input.eventDate ?? null,
        createdById: user.id,
        classes: { create: classes.map((c) => ({ tenantId: user.tenantId, classId: c.id })) },
      } as never,
    });

    if (students.length > 0) {
      // SQLite's Prisma client does not support createMany's skipDuplicates
      // option — harmless here anyway since this is a brand-new activity
      // with a brand-new id, so no real duplicate roster row can exist yet.
      await tenantDb().activityParticipant.createMany({
        data: students.map((s) => ({ tenantId: user.tenantId, activityId: activity.id, studentId: s.id, status: "NOT_PAID" })) as never,
      });
    }

    await audit(user, "activity.created", activity.id, { name: input.name, classCount: classes.length, studentCount: students.length });
    return { ...activity, rosterCount: students.length };
  });
}

/** Every real activity for the school, most recent first, with real roster/collection stats. */
export async function listActivities(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().schoolActivity.findMany({
      where: { archived: false },
      orderBy: { createdAt: "desc" },
      include: {
        classes: { include: undefined } as never,
        participants: true,
      },
    });
    const classIds = [...new Set(rows.flatMap((r) => (r as unknown as { classes: { classId: string }[] }).classes.map((c) => c.classId)))];
    const classMap = new Map((await tenantDb().schoolClass.findMany({ where: { id: { in: classIds } } })).map((c) => [c.id, c]));

    // Real outstanding balances come from the ACTUAL open invoices, never
    // an assumption that every WAIVED participant still owes the full
    // amount — a real partial payment against a waived balance must be
    // reflected honestly here too.
    const allInvoiceIds = rows.flatMap((r) => (r as unknown as { participants: { invoiceId: string | null; status: string }[] }).participants.filter((p) => p.status === "WAIVED" && p.invoiceId).map((p) => p.invoiceId as string));
    const openInvoices = allInvoiceIds.length ? await tenantDb().invoice.findMany({ where: { id: { in: allInvoiceIds } } }) : [];
    const invoiceMap = new Map(openInvoices.map((i) => [i.id, i]));

    return rows.map((r) => {
      const rr = r as unknown as { classes: { classId: string }[]; participants: { status: string; invoiceId: string | null }[] };
      const paidCount = rr.participants.filter((p) => p.status === "PAID").length;
      const waivedCount = rr.participants.filter((p) => p.status === "WAIVED").length;
      const notPaidCount = rr.participants.filter((p) => p.status === "NOT_PAID").length;
      const outstandingKes = rr.participants
        .filter((p) => p.status === "WAIVED" && p.invoiceId)
        .reduce((sum, p) => {
          const inv = invoiceMap.get(p.invoiceId as string);
          return sum + (inv ? Math.max(0, inv.totalKes - inv.discountKes - inv.paidKes) : 0);
        }, 0);
      return {
        id: r.id, name: r.name, description: r.description, amountKes: r.amountKes,
        year: r.year, term: r.term, eventDate: r.eventDate,
        classNames: rr.classes.map((c) => {
          const cls = classMap.get(c.classId);
          return cls ? [cls.level, cls.stream].filter(Boolean).join(" ") : "—";
        }),
        rosterCount: rr.participants.length,
        paidCount, waivedCount, notPaidCount,
        collectedKes: paidCount * r.amountKes,
        outstandingKes,
      };
    });
  });
}

/** The full real roster for one activity — every real student, their real status. */
export async function activityRoster(user: SessionUser, activityId: string) {
  return withTenant(user.tenantId, async () => {
    const activity = await tenantDb().schoolActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new SchoolActivityError("NOT_FOUND", "Activity not found.");

    const participants = await tenantDb().activityParticipant.findMany({
      where: { activityId },
      include: { activity: false } as never,
    });
    const studentIds = participants.map((p) => (p as unknown as { studentId: string }).studentId);
    const students = await tenantDb().student.findMany({ where: { id: { in: studentIds } }, include: { schoolClass: true } });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const invoiceIds = (participants as unknown as { invoiceId: string | null }[]).map((p) => p.invoiceId).filter((v): v is string => !!v);
    const invoices = invoiceIds.length ? await tenantDb().invoice.findMany({ where: { id: { in: invoiceIds } } }) : [];
    const invoiceMap = new Map(invoices.map((i) => [i.id, i]));

    const rows = (participants as unknown as { id: string; studentId: string; status: string; invoiceId: string | null; waivedReason: string | null; waivedAt: Date | null }[]).map((p) => {
      const s = studentMap.get(p.studentId);
      const inv = p.invoiceId ? invoiceMap.get(p.invoiceId) : undefined;
      return {
        id: p.id,
        studentId: p.studentId,
        studentName: s ? [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ") : "—",
        admissionNo: s?.admissionNo ?? "—",
        className: s?.schoolClass ? [s.schoolClass.level, s.schoolClass.stream].filter(Boolean).join(" ") : "—",
        status: p.status,
        waivedReason: p.waivedReason,
        waivedAt: p.waivedAt ? p.waivedAt.toISOString() : null,
        balanceKes: inv ? Math.max(0, inv.totalKes - inv.discountKes - inv.paidKes) : 0,
        invoiceNo: inv?.invoiceNo ?? null,
      };
    }).sort((a, b) => a.studentName.localeCompare(b.studentName));

    return {
      activity: {
        id: activity.id, name: activity.name, description: activity.description, amountKes: activity.amountKes,
        year: activity.year, term: activity.term, eventDate: activity.eventDate,
      },
      rows,
    };
  });
}

/**
 * Record a REAL payment for one student on the roster — creates a real,
 * ALREADY-FULLY-PAID Invoice (kind:"ACTIVITY") for exactly that student,
 * through the exact same recordWalkInPayment() machinery every other cash
 * payment at NEYO goes through (so it inherits the real R.3 biometric gate,
 * real duplicate-M-Pesa-ref protection, real receipt-to-portal delivery —
 * nothing is reinvented). A student who was previously WAIVED (owing a real
 * balance) can also pay off that SAME invoice this way — never a second one.
 */
export async function recordActivityPayment(
  user: SessionUser,
  input: { participantId: string; amountKes?: number; phone?: string; method: "cash" | "mpesa" | "bank"; mpesaRef?: string; biometricTicket?: string }
) {
  return withTenant(user.tenantId, async () => {
    const participant = await tenantDb().activityParticipant.findUnique({ where: { id: input.participantId } });
    if (!participant) throw new SchoolActivityError("NOT_FOUND", "That student is not on this activity's roster.");
    const p = participant as unknown as { id: string; activityId: string; studentId: string; status: string; invoiceId: string | null };
    if (p.status === "PAID") throw new SchoolActivityError("ALREADY", "This student has already paid for this activity.");

    const activity = await tenantDb().schoolActivity.findUniqueOrThrow({ where: { id: p.activityId } });
    const student = await tenantDb().student.findUniqueOrThrow({ where: { id: p.studentId } });
    const amount = input.amountKes ?? activity.amountKes;

    // Real payment, through the REAL front-desk machinery — inherits the
    // R.3 biometric gate, duplicate-ref protection, and receipt delivery.
    const payment = await recordWalkInPayment(
      user.tenantId,
      {
        amount, phone: input.phone || student.admissionNo, method: input.method,
        accountRef: student.admissionNo, mpesaRef: input.mpesaRef,
        description: `${activity.name} — ${student.firstName} ${student.lastName}`,
        biometricTicket: input.biometricTicket,
      } as never,
      { id: user.id, name: user.fullName }
    );

    // If this student was previously WAIVED, a real open invoice already
    // exists — pay it off directly rather than creating a second one. A
    // real PARTIAL payment against that existing balance must keep the
    // participant's real status as WAIVED (a genuine balance still remains)
    // — never falsely flip straight to PAID, exactly as R.6's own
    // regression test catches.
    let invoiceId = p.invoiceId;
    let fullyPaid: boolean;
    if (invoiceId) {
      const inv = await tenantDb().invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      const paid = inv.paidKes + amount;
      fullyPaid = paid >= inv.totalKes;
      await tenantDb().invoice.update({ where: { id: invoiceId }, data: { paidKes: paid, status: fullyPaid ? "PAID" : "PARTIAL" } });
      await db.payment.update({ where: { id: payment.id }, data: { invoiceId } });
    } else {
      fullyPaid = true; // a brand-new activity invoice is always created already fully paid (no partial-pay-from-scratch path exists yet)
      const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
      const inv = await tenantDb().invoice.create({
        data: {
          invoiceNo, studentId: p.studentId, description: `${activity.name} (Term ${activity.term} ${activity.year})`,
          totalKes: amount, paidKes: amount, discountKes: 0, status: "PAID",
          dueDate: activity.eventDate ?? new Date().toISOString().slice(0, 10),
          year: activity.year, term: activity.term, kind: "ACTIVITY",
        } as never,
      });
      invoiceId = inv.id;
      await db.payment.update({ where: { id: payment.id }, data: { invoiceId } });
    }

    await tenantDb().activityParticipant.update({
      where: { id: p.id },
      data: fullyPaid
        ? { status: "PAID", invoiceId, waivedReason: null, waivedById: null, waivedAt: null }
        : { status: "WAIVED", invoiceId } as never,
    });

    await audit(user, "activity.payment_recorded", p.id, { activityId: p.activityId, studentId: p.studentId, amount });
    return { participantId: p.id, invoiceId, paymentId: payment.id };
  });
}

/**
 * Waiver — the founder's real "parent asked for it to be recorded that
 * they'd pay later" case. Only NOW does a real Invoice with a real OPEN
 * balance get created for this one student — never before. From this point
 * it behaves exactly like any other real B.7 fee balance.
 */
export async function waiveActivityParticipant(user: SessionUser, participantId: string, reason: string) {
  return withTenant(user.tenantId, async () => {
    const participant = await tenantDb().activityParticipant.findUnique({ where: { id: participantId } });
    if (!participant) throw new SchoolActivityError("NOT_FOUND", "That student is not on this activity's roster.");
    const p = participant as unknown as { id: string; activityId: string; studentId: string; status: string; invoiceId: string | null };
    if (p.status === "PAID") throw new SchoolActivityError("ALREADY", "This student has already paid — nothing to waive.");
    if (p.status === "WAIVED") throw new SchoolActivityError("ALREADY", "This student already has a real open balance recorded for this activity.");

    const activity = await tenantDb().schoolActivity.findUniqueOrThrow({ where: { id: p.activityId } });

    const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
    const inv = await tenantDb().invoice.create({
      data: {
        invoiceNo, studentId: p.studentId, description: `${activity.name} (Term ${activity.term} ${activity.year}) — going, to pay later`,
        totalKes: activity.amountKes, paidKes: 0, discountKes: 0, status: "UNPAID",
        dueDate: activity.eventDate ?? new Date().toISOString().slice(0, 10),
        year: activity.year, term: activity.term, kind: "ACTIVITY",
      } as never,
    });

    await tenantDb().activityParticipant.update({
      where: { id: p.id },
      data: { status: "WAIVED", invoiceId: inv.id, waivedReason: reason, waivedById: user.id, waivedAt: new Date() } as never,
    });

    await audit(user, "activity.waived", p.id, { activityId: p.activityId, studentId: p.studentId, reason, invoiceId: inv.id, amountKes: activity.amountKes });
    return { participantId: p.id, invoiceId: inv.id };
  });
}

/**
 * Undo a waiver that was recorded in error — ONLY allowed while the real
 * invoice is still genuinely unpaid (paidKes === 0). Deletes the real
 * invoice and returns the student to NOT_PAID/no-balance. If any real money
 * has already been applied, this is refused — use the normal payment/refund
 * workflow instead, never a silent data-erasing shortcut.
 */
export async function unwaiveActivityParticipant(user: SessionUser, participantId: string) {
  return withTenant(user.tenantId, async () => {
    const participant = await tenantDb().activityParticipant.findUnique({ where: { id: participantId } });
    if (!participant) throw new SchoolActivityError("NOT_FOUND", "That student is not on this activity's roster.");
    const p = participant as unknown as { id: string; status: string; invoiceId: string | null };
    if (p.status !== "WAIVED" || !p.invoiceId) throw new SchoolActivityError("INVALID", "This student does not have an active waiver to undo.");

    const inv = await tenantDb().invoice.findUnique({ where: { id: p.invoiceId } });
    if (inv && inv.paidKes > 0) {
      throw new SchoolActivityError("INVALID", "This student has already paid part of this balance — undoing the waiver now would hide real money. Use a refund/adjustment instead.");
    }

    await tenantDb().activityParticipant.update({
      where: { id: p.id },
      data: { status: "NOT_PAID", invoiceId: null, waivedReason: null, waivedById: null, waivedAt: null } as never,
    });
    if (inv) await tenantDb().invoice.delete({ where: { id: inv.id } });

    await audit(user, "activity.waiver_undone", p.id, { invoiceId: p.invoiceId });
    return { participantId: p.id };
  });
}
