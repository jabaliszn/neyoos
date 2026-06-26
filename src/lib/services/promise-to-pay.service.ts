/**
 * G.28 — Fee Promise-to-Pay service.
 * Allows parents to commit to a payment date, and provides the bursar with
 * a "promises calendar" + auto-flagging of broken promises and follow-up SMS.
 */
import crypto from "crypto";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { sendSms } from "@/lib/notifications/sms";
import { createInApp } from "@/lib/services/notification.service";
import { checkSmsQuota, recordUsage } from "@/lib/services/limits.service";
import type { SessionUser } from "@/lib/core/session";

export class PromiseError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "QUOTA" | "INVALID", message: string) {
    super(message);
    this.name = "PromiseError";
  }
}


async function notifySchoolOfficialsOfDuePromise(tenantId: string, body: string) {
  const officials = await db.user.findMany({
    where: { tenantId, isActive: true, role: { in: ["BURSAR", "ACCOUNTANT", "PRINCIPAL", "SCHOOL_OWNER"] } },
    select: { id: true },
  });
  for (const official of officials) {
    await createInApp({
      tenantId,
      recipientId: official.id,
      title: "Promise-to-pay due today",
      body,
      category: "fees",
      href: "/finance",
    });
  }
  return officials.length;
}

/** Parent: Commit to a payment date for an invoice. */
export async function createPromiseToPay(
  user: SessionUser,
  input: { invoiceId: string; promiseDate: string; amountKes: number }
) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const inv = await tdb.invoice.findUnique({ where: { id: input.invoiceId } });
    if (!inv) throw new PromiseError("NOT_FOUND", "Invoice not found.");

    // Scoping check: must be their child's invoice
    const guardian = await tdb.guardian.findFirst({ where: { userId: user.id } });
    if (!guardian) throw new PromiseError("FORBIDDEN", "Only registered guardians can create promises.");

    const link = await tdb.studentGuardian.findFirst({
      where: { studentId: inv.studentId, guardianId: guardian.id },
    });
    if (!link) throw new PromiseError("FORBIDDEN", "This invoice does not belong to your child.");

    // Check if there is already an active promise for this invoice
    const existing = await tdb.promiseToPay.findFirst({
      where: { invoiceId: input.invoiceId, status: "ACTIVE" },
    });
    if (existing) throw new PromiseError("INVALID", "An active promise already exists for this invoice.");

    const balance = inv.totalKes - inv.discountKes - inv.paidKes;
    if (input.amountKes > balance) throw new PromiseError("INVALID", `Amount exceeds the invoice balance of KES ${balance}.`);

    const promise = await tdb.promiseToPay.create({
      data: {
        tenantId: user.tenantId,
        invoiceId: input.invoiceId,
        studentId: inv.studentId,
        guardianId: guardian.id,
        promiseDate: input.promiseDate,
        amountKes: input.amountKes,
        status: "ACTIVE",
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "promise.created",
        entityType: "invoice",
        entityId: input.invoiceId,
        metadata: JSON.stringify({ promiseDate: input.promiseDate, amountKes: input.amountKes }),
      },
    });

    return promise;
  });
}

/** Bursar: List all promises. */
export async function listPromises(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const list = await tenantDb().promiseToPay.findMany({
      include: {
        invoice: { select: { invoiceNo: true, description: true, status: true, totalKes: true, paidKes: true, discountKes: true } },
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
        guardian: { select: { fullName: true, phone: true } },
      },
      orderBy: { promiseDate: "asc" },
    });

    return list.map((p) => ({
      id: p.id,
      promiseDate: p.promiseDate,
      amountKes: p.amountKes,
      status: p.status,
      planGroupId: p.planGroupId,
      installmentNo: p.installmentNo,
      reminderSentAt: p.reminderSentAt,
      studentName: `${p.student.firstName} ${p.student.lastName}`,
      admissionNo: p.student.admissionNo,
      invoiceNo: p.invoice.invoiceNo,
      guardianName: p.guardian.fullName,
      guardianPhone: p.guardian.phone,
      invoiceBalance: Math.max(0, p.invoice.totalKes - p.invoice.discountKes - p.invoice.paidKes),
    }));
  });
}

/** Background Task: Auto-check and flag broken/kept promises. */
export async function checkBrokenPromises(tenantId: string) {
  return withTenant(tenantId, async () => {
    const tdb = tenantDb();
    const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

    const activePromises = await tdb.promiseToPay.findMany({
      where: { status: "ACTIVE" },
      include: {
        invoice: true,
        guardian: true,
        student: true,
      },
    });

    let brokenCount = 0;
    let keptCount = 0;
    let dueParentSms = 0;
    let dueOfficialNotifications = 0;

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });

    // I.24/I.99: on due date, remind the parent by SMS and notify school officials once.
    for (const p of activePromises.filter((x) => x.promiseDate === today && !x.reminderSentAt)) {
      const balance = p.invoice.totalKes - p.invoice.discountKes - p.invoice.paidKes;
      const officialBody = `${p.guardian.fullName} promised KES ${p.amountKes.toLocaleString("en-KE")} today for ${p.student.firstName} ${p.student.lastName} (${p.invoice.invoiceNo}). Current balance: KES ${balance.toLocaleString("en-KE")}.`;
      dueOfficialNotifications += await notifySchoolOfficialsOfDuePromise(tenantId, officialBody);

      const quota = await checkSmsQuota(tenantId, 1);
      if (quota.allowed && p.guardian.phone) {
        await sendSms(p.guardian.phone, `${tenant.name}: Reminder — payment promise of KES ${p.amountKes.toLocaleString("en-KE")} for ${p.student.firstName} is due today. You can pay any amount by M-Pesa using invoice ${p.invoice.invoiceNo}.`);
        await recordUsage(tenantId, "smsPerTerm", 1);
        dueParentSms++;
      }
      await tdb.promiseToPay.update({ where: { id: p.id }, data: { reminderSentAt: new Date() } });
    }

    for (const p of activePromises) {
      const invBal = p.invoice.totalKes - p.invoice.discountKes - p.invoice.paidKes;

      // 1) Is it KEPT? (invoice is fully paid or remaining balance is 0)
      if (invBal === 0 || p.invoice.status === "PAID") {
        await tdb.promiseToPay.update({
          where: { id: p.id },
          data: { status: "KEPT" },
        });
        keptCount++;
        continue;
      }

      // 2) Is it BROKEN? (promise date has passed, and invoice still has outstanding balance)
      if (p.promiseDate < today && invBal > 0) {
        await tdb.promiseToPay.update({
          where: { id: p.id },
          data: { status: "BROKEN" },
        });
        brokenCount++;

        // Send follow-up SMS automatically
        const quota = await checkSmsQuota(tenantId, 1);
        if (quota.allowed && p.guardian.phone) {
          const msg = `${tenant.name}: Dear ${p.guardian.fullName}, the promise to pay KES ${p.amountKes.toLocaleString("en-KE")} for ${p.student.firstName} (due ${p.promiseDate}) is overdue. Please settle it to avoid service disruption.`;
          try {
            await sendSms(p.guardian.phone, msg);
            await recordUsage(tenantId, "smsPerTerm", 1);
          } catch {
            /* ignore */
          }
        }
      }
    }

    return { keptCount, brokenCount, dueParentSms, dueOfficialNotifications };
  });
}


/** I.99 — Bursar/finance: create a per-parent installment schedule. */
export async function createInstallmentPlan(
  user: SessionUser,
  input: { invoiceId: string; installments: { promiseDate: string; amountKes: number }[] }
) {
  return withTenant(user.tenantId, async () => {
    const inv = await tenantDb().invoice.findUnique({ where: { id: input.invoiceId } });
    if (!inv) throw new PromiseError("NOT_FOUND", "Invoice not found.");
    const clean = input.installments
      .map((x) => ({ promiseDate: x.promiseDate, amountKes: Math.trunc(x.amountKes) }))
      .filter((x) => x.promiseDate && x.amountKes > 0)
      .sort((a, b) => a.promiseDate.localeCompare(b.promiseDate));
    if (clean.length === 0) throw new PromiseError("INVALID", "Add at least one installment.");
    const balance = inv.totalKes - inv.discountKes - inv.paidKes;
    const total = clean.reduce((s, x) => s + x.amountKes, 0);
    if (total > balance) throw new PromiseError("INVALID", `Installments exceed the invoice balance of KES ${balance.toLocaleString("en-KE")}.`);

    const guardian = await tenantDb().studentGuardian.findFirst({
      where: { studentId: inv.studentId, isPrimary: true }, include: { guardian: true, student: true },
    }) ?? await tenantDb().studentGuardian.findFirst({ where: { studentId: inv.studentId }, include: { guardian: true, student: true } });
    if (!guardian) throw new PromiseError("NOT_FOUND", "No guardian is linked to this invoice's learner.");

    // Replace old active plan items for the invoice with the new schedule.
    await db.promiseToPay.updateMany({ where: { tenantId: user.tenantId, invoiceId: inv.id, status: "ACTIVE" }, data: { status: "CANCELLED" } });
    const planGroupId = `plan_${crypto.randomBytes(6).toString("hex")}`;
    const rows = [];
    for (let i = 0; i < clean.length; i++) {
      rows.push(await db.promiseToPay.create({ data: {
        tenantId: user.tenantId, invoiceId: inv.id, studentId: inv.studentId,
        guardianId: guardian.guardianId, promiseDate: clean[i].promiseDate, amountKes: clean[i].amountKes,
        planGroupId, installmentNo: i + 1, status: "ACTIVE",
      } }));
    }
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true } });
    if (guardian.guardian.phone) {
      const quota = await checkSmsQuota(user.tenantId, 1);
      if (quota.allowed) {
        await sendSms(guardian.guardian.phone, `${tenant.name}: Payment plan set for ${guardian.student.firstName}. ${clean.length} installment(s), total KES ${total.toLocaleString("en-KE")}. First due ${clean[0].promiseDate}.`);
        await recordUsage(user.tenantId, "smsPerTerm", 1);
      }
    }
    await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "promise.installment_plan_created", entityType: "invoice", entityId: inv.id, metadata: JSON.stringify({ planGroupId, installments: clean.length, total }) } });
    return { planGroupId, installments: rows.length, totalKes: total };
  });
}

/** I.99 — send due-date reminders for active installments due today. */
export async function sendDueInstallmentReminders(tenantId: string) {
  return withTenant(tenantId, async () => {
    const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    const due = await tenantDb().promiseToPay.findMany({
      where: { status: "ACTIVE", promiseDate: today, reminderSentAt: null },
      include: { guardian: true, student: true, invoice: true },
      take: 200,
    });
    if (due.length === 0) return { sent: 0, skipped: 0 };
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
    const quota = await checkSmsQuota(tenantId, due.filter((p) => p.guardian.phone).length);
    let sent = 0, skipped = 0;
    let officialNotifications = 0;
    for (const p of due) {
      const balance = p.invoice.totalKes - p.invoice.discountKes - p.invoice.paidKes;
      officialNotifications += await notifySchoolOfficialsOfDuePromise(tenantId, `${p.guardian.fullName} has installment ${p.installmentNo ?? ""} due today for ${p.student.firstName} (${p.invoice.invoiceNo}), KES ${p.amountKes.toLocaleString("en-KE")}. Balance: KES ${balance.toLocaleString("en-KE")}.`);
      if (!p.guardian.phone || !quota.allowed) { skipped++; await db.promiseToPay.update({ where: { id: p.id }, data: { reminderSentAt: new Date() } }); continue; }
      await sendSms(p.guardian.phone, `${tenant.name}: Reminder — installment ${p.installmentNo ?? ""} of KES ${p.amountKes.toLocaleString("en-KE")} for ${p.student.firstName} is due today. Current balance: KES ${balance.toLocaleString("en-KE")}.`);
      await db.promiseToPay.update({ where: { id: p.id }, data: { reminderSentAt: new Date() } });
      sent++;
    }
    if (sent > 0) await recordUsage(tenantId, "smsPerTerm", sent);
    return { sent, skipped, officialNotifications };
  });
}
