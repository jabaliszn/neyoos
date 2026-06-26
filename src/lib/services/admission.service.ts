/**
 * B.2 Admissions — service.
 * Pipeline: APPLIED -> REVIEW -> INTERVIEW -> OFFER -> ADMITTED
 *           (or WAITLISTED / REJECTED / WITHDRAWN at any staff step).
 * Admit = creates the REAL B.1 student (guardian + G.9 requirements seeded)
 * and links it. Interview scheduling creates an A.17 calendar event.
 * Walk-ins: A.18 AdmissionInquiry rows convert into applications.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { nextTenantId } from "@/lib/services/identity.service";
import { createStudent } from "@/lib/services/student.service";
import { createEvent } from "@/lib/services/calendar.service";
import { issueVerification } from "@/lib/services/document.service";
import type { SessionUser } from "@/lib/core/session";
import type { ApplyInput, DecisionInput, ApplicationStatus } from "@/lib/validations/admission";

export class AdmissionError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID_STATE" | "DUPLICATE", message: string) {
    super(message);
    this.name = "AdmissionError";
  }
}

async function audit(tenantId: string, actor: { id: string; name: string } | null, action: string, entityId: string, metadata: unknown) {
  await db.auditLog.create({
    data: {
      tenantId,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? "Online applicant",
      action,
      entityType: "admissionApplication",
      entityId,
      metadata: JSON.stringify(metadata),
    },
  });
}

/** PUBLIC online application (B.2.1). No session — tenant from subdomain. */
export async function submitApplication(tenantId: string, input: ApplyInput, source: "online" | "walk_in" | "inquiry" = "online", inquiryId?: string) {
  return withTenant(tenantId, async () => {
    // Defense in depth: normalize the phone even when callers bypass Zod.
    const { normalizeKePhone } = await import("@/lib/validations/auth");
    input = { ...input, guardianPhone: normalizeKePhone(input.guardianPhone) ?? input.guardianPhone };
    // Light duplicate guard: same child name + guardian phone, still open.
    const dup = await tenantDb().admissionApplication.findFirst({
      where: {
        firstName: input.firstName,
        lastName: input.lastName,
        guardianPhone: input.guardianPhone,
        status: { notIn: ["REJECTED", "WITHDRAWN", "ADMITTED"] },
      },
    });
    if (dup) throw new AdmissionError("DUPLICATE", "An application for this child with this phone number is already in progress.");

    const applicationNo = await nextTenantId(tenantId, "ADMISSION");
    const app = await tenantDb().admissionApplication.create({
      data: {
        applicationNo,
        firstName: input.firstName,
        middleName: input.middleName || null,
        lastName: input.lastName,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth || null,
        gradeWanted: input.gradeWanted,
        curriculum: input.curriculum ?? null,
        previousSchool: input.previousSchool || null,
        guardianName: input.guardianName,
        guardianPhone: input.guardianPhone,
        guardianEmail: input.guardianEmail || null,
        notes: input.notes || null,
        source,
        inquiryId: inquiryId ?? null,
      } as never,
    });
    await audit(tenantId, null, "admission.applied", app.id, { applicationNo, source });
    return { id: app.id, applicationNo };
  });
}

/** Convert an A.18 walk-in inquiry into an application (B.2.4). */
export async function convertInquiry(user: SessionUser, inquiryId: string) {
  return withTenant(user.tenantId, async () => {
    const inq = await tenantDb().admissionInquiry.findUnique({ where: { id: inquiryId } });
    if (!inq) throw new AdmissionError("NOT_FOUND", "Inquiry not found.");
    const [firstName, ...rest] = (inq.studentName ?? "Pending Name").trim().split(/\s+/);
    const result = await submitApplication(
      user.tenantId,
      {
        firstName: firstName || "Pending",
        lastName: rest.join(" ") || "Name",
        gender: "M", // unknown at inquiry stage; staff edits in review
        gradeWanted: inq.gradeWanted ?? "Pending",
        curriculum: (inq.curriculum as "CBC" | "8-4-4" | null) ?? undefined,
        guardianName: inq.parentName,
        guardianPhone: inq.phone,
        notes: inq.notes || "",
        middleName: "", dateOfBirth: "", previousSchool: "", guardianEmail: "",
      },
      "inquiry",
      inq.id
    );
    await tenantDb().admissionInquiry.update({ where: { id: inq.id }, data: { status: "CONTACTED" } });
    await audit(user.tenantId, { id: user.id, name: user.fullName }, "admission.inquiry_converted", result.id, { inquiryId });
    return result;
  });
}

const TRANSITIONS: Record<string, ApplicationStatus[]> = {
  review: ["APPLIED", "WAITLISTED"],
  schedule_interview: ["APPLIED", "REVIEW", "WAITLISTED"],
  offer: ["REVIEW", "INTERVIEW", "WAITLISTED"],
  waitlist: ["APPLIED", "REVIEW", "INTERVIEW", "OFFER"],
  reject: ["APPLIED", "REVIEW", "INTERVIEW", "OFFER", "WAITLISTED"],
  withdraw: ["APPLIED", "REVIEW", "INTERVIEW", "OFFER", "WAITLISTED"],
  record_deposit: ["OFFER"],
  admit: ["OFFER"],
};

/** Staff pipeline action (B.2.2/3/5/6/8/9). */
export async function decide(user: SessionUser, applicationId: string, input: DecisionInput) {
  return withTenant(user.tenantId, async () => {
    const app = await tenantDb().admissionApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new AdmissionError("NOT_FOUND", "Application not found.");
    const allowed = TRANSITIONS[input.action];
    if (!allowed.includes(app.status as ApplicationStatus))
      throw new AdmissionError("INVALID_STATE", `Cannot ${input.action.replace("_", " ")} an application in ${app.status} state.`);

    const actor = { id: user.id, name: user.fullName };
    const tdb = tenantDb();

    switch (input.action) {
      case "review": {
        await tdb.admissionApplication.update({ where: { id: app.id }, data: { status: "REVIEW" } });
        break;
      }
      case "schedule_interview": {
        if (!input.interviewDate) throw new AdmissionError("INVALID_STATE", "Interview date is required.");
        // A.17 calendar event so the interview shows on the school calendar.
        const event = await createEvent(
          {
            title: `Admission interview — ${app.firstName} ${app.lastName} (${app.applicationNo})`,
            date: input.interviewDate,
            startTime: input.interviewTime ?? undefined,
            endTime: undefined,
            type: "meeting",
            audience: "all",
            location: "Admissions office",
            description: input.interviewNote || undefined,
          } as never,
          user.id
        );
        await tdb.admissionApplication.update({
          where: { id: app.id },
          data: {
            status: "INTERVIEW",
            interviewDate: input.interviewDate,
            interviewTime: input.interviewTime ?? null,
            interviewNote: input.interviewNote || null,
            calendarEventId: event.id,
          },
        });
        break;
      }
      case "offer": {
        await tdb.admissionApplication.update({
          where: { id: app.id },
          data: { status: "OFFER", depositRequiredKes: input.depositRequiredKes ?? 0, decisionNote: input.note || null },
        });
        break;
      }
      case "waitlist": {
        await tdb.admissionApplication.update({ where: { id: app.id }, data: { status: "WAITLISTED", decisionNote: input.note || null } });
        break;
      }
      case "reject": {
        await tdb.admissionApplication.update({ where: { id: app.id }, data: { status: "REJECTED", decisionNote: input.note || null } });
        break;
      }
      case "withdraw": {
        await tdb.admissionApplication.update({ where: { id: app.id }, data: { status: "WITHDRAWN", decisionNote: input.note || null } });
        break;
      }
      case "record_deposit": {
        if (!input.amountKes) throw new AdmissionError("INVALID_STATE", "Deposit amount is required.");
        const paid = app.depositPaidKes + input.amountKes;
        await tdb.admissionApplication.update({
          where: { id: app.id },
          data: { depositPaidKes: paid, depositPaidAt: new Date(), depositRef: input.reference || null },
        });
        break;
      }
      case "admit": {
        // Deposit-before-admission (B.2.8): enforce when a deposit was required.
        if (app.depositRequiredKes > 0 && app.depositPaidKes < app.depositRequiredKes)
          throw new AdmissionError(
            "INVALID_STATE",
            `Deposit of KES ${app.depositRequiredKes.toLocaleString("en-KE")} required — KES ${app.depositPaidKes.toLocaleString("en-KE")} paid so far.`
          );
        // Onboarding sequence (B.2.9): create the REAL student via B.1.
        const student = await createStudent(user, {
          firstName: app.firstName,
          middleName: app.middleName || "",
          lastName: app.lastName,
          gender: app.gender as "M" | "F",
          dateOfBirth: app.dateOfBirth || "",
          classId: input.classId || "",
          photoUrl: "", upiNumber: "", birthCertNo: "",
          notes: `Admitted via application ${app.applicationNo}`,
          createLogin: false,
          guardians: [{
            fullName: app.guardianName,
            phone: app.guardianPhone,
            email: app.guardianEmail || "",
            nationalId: "",
            relationship: "Parent",
            isPrimary: true,
            createLogin: false,
          }],
          seedRequirements: true,
        });
        await tdb.admissionApplication.update({
          where: { id: app.id },
          data: { status: "ADMITTED", studentId: (student as { id: string }).id, decisionNote: input.note || null },
        });
        if (app.inquiryId) {
          await tdb.admissionInquiry.update({ where: { id: app.inquiryId }, data: { status: "ENROLLED" } }).catch(() => null);
        }
        break;
      }
    }

    await audit(user.tenantId, actor, `admission.${input.action}`, app.id, { from: app.status });
    const updated = await tdb.admissionApplication.findUnique({ where: { id: app.id } });
    return updated!;
  });
}

/** Pipeline board data, grouped by status. */
export async function pipeline(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().admissionApplication.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
    return rows.map((a) => ({
      id: a.id,
      applicationNo: a.applicationNo,
      name: [a.firstName, a.middleName, a.lastName].filter(Boolean).join(" "),
      gender: a.gender,
      gradeWanted: a.gradeWanted,
      curriculum: a.curriculum,
      guardianName: a.guardianName,
      guardianPhone: a.guardianPhone,
      status: a.status,
      source: a.source,
      interviewDate: a.interviewDate,
      interviewTime: a.interviewTime,
      depositRequiredKes: a.depositRequiredKes,
      depositPaidKes: a.depositPaidKes,
      studentId: a.studentId,
      createdAt: a.createdAt,
    }));
  });
}

/** Admission letter PDF (B.2.7) — co-branded + QR like the transfer letter. */
export async function buildAdmissionLetterPdf(tenantId: string, applicationId: string, issuedByName: string) {
  const { renderAdmissionLetterPdf } = await import("@/lib/documents/admission-letter-pdf");
  const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");

  const [app, tenant] = await Promise.all([
    db.admissionApplication.findFirst({ where: { id: applicationId, tenantId } }),
    db.tenant.findUnique({ where: { id: tenantId } }),
  ]);
  if (!app || !tenant) throw new AdmissionError("NOT_FOUND", "Application not found.");
  if (!["OFFER", "ADMITTED"].includes(app.status))
    throw new AdmissionError("INVALID_STATE", "Letters are issued at Offer or after admission.");

  const name = [app.firstName, app.middleName, app.lastName].filter(Boolean).join(" ");
  const letterNo = `ADM-${app.id.slice(-8).toUpperCase()}`;
  let code = app.letterCode;
  if (!code) {
    code = await issueVerification(tenantId, "admission_letter", `${letterNo} — ${name} (${app.applicationNo}) ${app.gradeWanted}`, {
      letterNo, name, applicationNo: app.applicationNo, grade: app.gradeWanted,
    });
    await db.admissionApplication.update({ where: { id: app.id }, data: { letterCode: code } });
  }

  // G.9 joining requirements onto the letter (parents see the shopping list).
  let requirements: { label: string; category: string; quantity?: number }[] = [];
  try { requirements = tenant.joiningRequirements ? JSON.parse(tenant.joiningRequirements) : []; } catch { /* none */ }

  const pdf = await renderAdmissionLetterPdf({
    schoolName: tenant.name,
    county: tenant.county,
    motto: tenant.motto,
    addressLine: tenant.addressLine,
    brandPrimary: tenant.brandPrimary || "#1c2740",
    logoUrl: tenant.logoUrl,
    applicantName: name,
    applicationNo: app.applicationNo,
    gradeOffered: app.gradeWanted,
    curriculum: app.curriculum,
    guardianName: app.guardianName,
    admitted: app.status === "ADMITTED",
    depositRequiredKes: app.depositRequiredKes,
    requirements: requirements.slice(0, 14),
    letterNo,
    verifyCode: code,
    qrDataUrl: await qrDataUrl(verifyUrl(code)),
    issuedByName,
    issuedDate: new Date().toISOString().slice(0, 10),
  });
  return { pdf, fileName: `${letterNo}-${app.applicationNo}.pdf` };
}
