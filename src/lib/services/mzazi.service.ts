import crypto from "crypto";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { scopeWhere } from "@/lib/services/student.service";
import { normalizeKePhone } from "@/lib/validations/auth";

/**
 * G.13 — "Mzazi Card": a printable A6 fee slip per learner for feature-phone
 * families. The card shows the school, learner + adm no, a fee balance snapshot,
 * the M-Pesa Paybill + account number, and a QR that opens a PUBLIC page where a
 * guardian can check the LIVE balance after a phone challenge (no login).
 *
 * Reuses A.10 DocumentVerification (the QR code is permanent per learner) and
 * the B.7 invoice ledger for balances. No new DB table.
 */

export class MzaziError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID", message: string) {
    super(message);
    this.name = "MzaziError";
  }
}

const fullName = (s: { firstName: string; middleName: string | null; lastName: string }) =>
  [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");

/** Open balance across a student's invoices = total − discount − paid, floored 0. */
async function studentBalanceKes(studentId: string): Promise<number> {
  const invoices = await tenantDb().invoice.findMany({ where: { studentId } });
  return invoices.reduce((s, i) => s + Math.max(0, i.totalKes - i.discountKes - i.paidKes), 0);
}

/**
 * Get-or-create the permanent verification code for a learner's Mzazi card.
 * Idempotent: the same learner always gets the same code (so a printed QR keeps
 * working). docType "mzazi_card", payloadHash = sha256(tenant:student).
 */
async function mzaziCardCode(tenantId: string, studentId: string, studentName: string, admissionNo: string): Promise<string> {
  const payloadHash = crypto.createHash("sha256").update(`mzazi:${tenantId}:${studentId}`).digest("hex");
  const existing = await db.documentVerification.findFirst({
    where: { tenantId, docType: "mzazi_card", payloadHash },
  });
  if (existing) return existing.code;
  const code = crypto.randomBytes(5).toString("hex").toUpperCase();
  await db.documentVerification.create({
    data: {
      tenantId,
      code,
      docType: "mzazi_card",
      summary: `Mzazi card — ${studentName} (${admissionNo})`,
      payloadHash,
    },
  });
  return code;
}

/** Shared assembly: pull everything an A6 card needs for one student. */
async function cardData(tenantId: string, studentId: string) {
  const student = await tenantDb().student.findFirst({
    where: { id: studentId },
    include: { schoolClass: true },
  });
  if (!student) throw new MzaziError("NOT_FOUND", "Student not found.");

  const [tenant, creds] = await Promise.all([
    db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    db.paymentCredential.findUnique({ where: { tenantId } }),
  ]);

  const name = fullName(student);
  const className = student.schoolClass
    ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ")
    : "Unassigned";
  const balanceKes = await studentBalanceKes(studentId);
  const code = await mzaziCardCode(tenantId, studentId, name, student.admissionNo);

  return {
    schoolName: tenant.name,
    motto: tenant.motto,
    county: tenant.county,
    addressLine: tenant.addressLine,
    brandPrimary: tenant.brandPrimary || "#1c2740",
    studentName: name,
    admissionNo: student.legacyAdmissionNo ? `${student.legacyAdmissionNo} · NEYO ${student.admissionNo}` : student.admissionNo,
    className,
    balanceKes,
    paybill: creds?.shortcode ?? null, // M-Pesa Paybill/Till (A.6); null until set
    accountNo: student.legacyAdmissionNo ?? student.admissionNo, // parent may pay using school or NEYO admission number
    verifyCode: code,
  };
}

/** Build a single learner's A6 Mzazi card PDF (row-scoped). */
export async function buildMzaziCardPdf(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const allowed = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] }, select: { id: true } });
    if (!allowed) throw new MzaziError("NOT_FOUND", "Student not found.");

    const { renderMzaziCardsPdf } = await import("@/lib/documents/mzazi-card-pdf");
    const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");

    const d = await cardData(user.tenantId, studentId);
    const pdf = await renderMzaziCardsPdf([{ ...d, qrDataUrl: await qrDataUrl(mzaziUrl(verifyUrl, d.verifyCode)) }]);
    return { pdf, fileName: `mzazi-${d.admissionNo}.pdf` };
  });
}

/** Build a whole-class batch of A6 Mzazi cards (one per active learner). */
export async function buildClassMzaziBatchPdf(user: SessionUser, classId: string) {
  return withTenant(user.tenantId, async () => {
    const klass = await tenantDb().schoolClass.findUnique({ where: { id: classId } });
    if (!klass) throw new MzaziError("NOT_FOUND", "Class not found.");
    const students = await tenantDb().student.findMany({
      where: { classId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true },
    });
    if (students.length === 0) throw new MzaziError("INVALID", "No active students in this class.");

    const { renderMzaziCardsPdf } = await import("@/lib/documents/mzazi-card-pdf");
    const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");

    const cards = [];
    for (const s of students) {
      const d = await cardData(user.tenantId, s.id);
      cards.push({ ...d, qrDataUrl: await qrDataUrl(mzaziUrl(verifyUrl, d.verifyCode)) });
    }
    const label = [klass.level, klass.stream].filter(Boolean).join(" ");
    const pdf = await renderMzaziCardsPdf(cards);
    return { pdf, fileName: `mzazi-cards-${label.replace(/\s+/g, "-")}.pdf`, count: cards.length };
  });
}

/** The QR points at the PUBLIC mzazi page (not the generic /verify). */
function mzaziUrl(verifyUrl: (c: string) => string, code: string): string {
  // verifyUrl gives ".../verify/<code>"; swap the segment for the mzazi page.
  return verifyUrl(code).replace("/verify/", "/mzazi/");
}

/**
 * PUBLIC, no-login balance lookup behind a guardian-phone challenge.
 * Returns the school + masked learner name always; the live balance ONLY when
 * the supplied phone matches a guardian on the learner's record. Privacy-safe:
 * a stranger scanning the QR can't read the balance without the family phone.
 */
export async function mzaziLookup(code: string, rawPhone: string) {
  const rec = await db.documentVerification.findUnique({ where: { code: code.toUpperCase() } });
  if (!rec || rec.docType !== "mzazi_card") return { found: false as const };

  return withTenant(rec.tenantId, async () => {
    // The code's payloadHash is sha256("mzazi:tenant:student"); find the student
    // by matching the hash (we don't store studentId on the verification row).
    const students = await tenantDb().student.findMany({
      include: { schoolClass: true, guardians: { include: { guardian: true } } },
    });
    let match: (typeof students)[number] | undefined;
    for (const s of students) {
      const h = crypto.createHash("sha256").update(`mzazi:${rec.tenantId}:${s.id}`).digest("hex");
      if (h === rec.payloadHash) { match = s; break; }
    }
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: rec.tenantId } });
    if (!match) return { found: true as const, schoolName: tenant.name, learner: null, ok: false as const };

    const name = fullName(match);
    const maskedLearner = maskName(name);

    const normalized = normalizeKePhone(rawPhone);
    const guardianPhones = match.guardians.map((g) => g.guardian.phone);
    const phoneOk = !!normalized && guardianPhones.includes(normalized);

    if (!phoneOk) {
      return {
        found: true as const,
        schoolName: tenant.name,
        learner: maskedLearner, // masked so the scanner sees *which* family without full PII
        ok: false as const,
      };
    }

    const balanceKes = await studentBalanceKes(match.id);
    const creds = await db.paymentCredential.findUnique({ where: { tenantId: rec.tenantId } });
    return {
      found: true as const,
      schoolName: tenant.name,
      learner: name,
      admissionNo: match.legacyAdmissionNo ? `${match.legacyAdmissionNo} · NEYO ${match.admissionNo}` : match.admissionNo,
      className: match.schoolClass ? [match.schoolClass.level, match.schoolClass.stream].filter(Boolean).join(" ") : null,
      balanceKes,
      paybill: creds?.shortcode ?? null,
      accountNo: match.legacyAdmissionNo ?? match.admissionNo,
      ok: true as const,
    };
  });
}



async function studentFromMzaziCode(code: string) {
  const rec = await db.documentVerification.findUnique({ where: { code: code.toUpperCase() } });
  if (!rec || rec.docType !== "mzazi_card") throw new MzaziError("NOT_FOUND", "Mzazi card not found.");
  return withTenant(rec.tenantId, async () => {
    const students = await tenantDb().student.findMany({
      include: { guardians: { include: { guardian: true } } },
    });
    for (const s of students) {
      const h = crypto.createHash("sha256").update(`mzazi:${rec.tenantId}:${s.id}`).digest("hex");
      if (h === rec.payloadHash) return { tenantId: rec.tenantId, student: s };
    }
    throw new MzaziError("NOT_FOUND", "Learner not found for this card.");
  });
}

/** I.41 — PUBLIC QR → direct M-Pesa STK after guardian phone verification. */
export async function mzaziPay(code: string, rawPhone: string, amountKes: number) {
  const normalized = normalizeKePhone(rawPhone);
  if (!normalized) throw new MzaziError("INVALID", "Enter a valid Kenyan phone number.");
  if (amountKes < 1) throw new MzaziError("INVALID", "Enter a valid amount.");

  const { tenantId, student } = await studentFromMzaziCode(code);
  return withTenant(tenantId, async () => {
    const guardianPhones = student.guardians.map((g) => g.guardian.phone);
    if (!guardianPhones.includes(normalized)) {
      throw new MzaziError("INVALID", "That phone is not on this learner's record.");
    }
    const balanceKes = await studentBalanceKes(student.id);
    if (balanceKes <= 0) throw new MzaziError("INVALID", "This learner has no fee balance to pay.");
    if (amountKes > balanceKes) throw new MzaziError("INVALID", `Amount exceeds the current balance of KES ${balanceKes.toLocaleString("en-KE")}.`);

    const openInvoice = await tenantDb().invoice.findFirst({
      where: { studentId: student.id, status: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });
    if (!openInvoice) throw new MzaziError("NOT_FOUND", "No open invoice found for this learner.");

    const { initiateStkPush } = await import("@/lib/services/payment.service");
    const accountRef = (student.legacyAdmissionNo ?? student.admissionNo).slice(0, 20);
    const result = await initiateStkPush(tenantId, {
      amount: amountKes,
      phone: normalized,
      accountRef,
      description: `Fees for ${fullName(student)}`.slice(0, 60),
    });
    await db.payment.update({ where: { id: result.paymentId }, data: { invoiceId: openInvoice.id } });
    await db.auditLog.create({
      data: {
        tenantId,
        actorName: "Mzazi Card",
        action: "mzazi.stk_initiated",
        entityType: "student",
        entityId: student.id,
        metadata: JSON.stringify({ amountKes, accountRef, invoiceId: openInvoice.id }),
      },
    });
    return { checkoutRequestId: result.checkoutRequestId, paymentId: result.paymentId, invoiceId: openInvoice.id, amountKes, accountRef };
  });
}

/** "Achieng Mary Otieno" -> "Achieng M. O." for the un-authenticated view. */
function maskName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return [parts[0], ...parts.slice(1).map((p) => `${p[0]}.`)].join(" ");
}
