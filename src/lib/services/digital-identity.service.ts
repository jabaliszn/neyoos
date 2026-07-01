import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import { SessionUser } from "@/lib/core/session";
import crypto from "node:crypto";
import { renderStudentTransferPassportPdf } from "@/lib/documents/student-transfer-passport-pdf";
import type { TransferPassportRequestInput, TransferPassportRedeemInput } from "@/lib/validations/digital-identity";
import { assertLawfulTransferBasis } from "@/lib/services/retention.service";
import { assertJFeatureEnabled } from "@/lib/services/platform-flags.service";

export class DigitalIdentityError extends Error {
  code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "EXPIRED" | "DISABLED";
  fields?: Record<string, string>;

  constructor(code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "EXPIRED" | "DISABLED", message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "DigitalIdentityError";
    this.code = code;
    this.fields = fields;
  }
}

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function writeAudit(tenantId: string, actorId: string | null, actorName: string | null, action: string, entityId: string, metadata: Record<string, unknown>, entityType = "TransferPassportRequest") {
  try {
    await db.auditLog.create({
      data: {
        tenantId,
        actorId,
        actorName,
        action,
        entityType,
        entityId,
        metadata: JSON.stringify(metadata),
      },
    });
  } catch {}
}

export async function generateDigitalIdentitySnapshot(user: SessionUser, studentId: string, modules: string[]) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const student = await tDb.student.findUnique({
      where: { id: studentId },
      include: {
        guardians: { include: { guardian: true } },
        schoolClass: true,
        attendance: modules.includes("ATTENDANCE") ? { take: 60, orderBy: { date: "desc" } } : false,
        portfolioItems: modules.includes("PORTFOLIO") ? { where: { status: "APPROVED", visibleToParents: true }, orderBy: { approvedAt: "desc" }, take: 20 } : false,
      },
    });

    if (!student) throw new DigitalIdentityError("NOT_FOUND", "Student not found.");

    const tenant = await tDb.tenant.findUnique({ where: { id: user.tenantId } });

    const identity: any = {
      profile: {
        studentId: student.id,
        admissionNo: student.admissionNo,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: [student.firstName, student.lastName].filter(Boolean).join(" "),
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        upiNumber: student.upiNumber,
        className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
        guardians: student.guardians.map((g) => ({
          fullName: g.guardian.fullName,
          phone: g.guardian.phone,
        })),
      },
      issuingSchool: tenant ? {
        name: tenant.name,
        county: tenant.county,
        addressLine: tenant.addressLine,
        motto: tenant.motto,
        brandPrimary: tenant.brandPrimary,
      } : null,
      modules,
      generatedAt: new Date().toISOString(),
    };

    if (modules.includes("ACADEMIC")) {
      identity.academics = await tDb.examResult.findMany({
        where: { studentId },
        include: { exam: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
      identity.leavingCertificate = await tDb.leavingCertificate.findFirst({ where: { studentId } });
      identity.communityService = await tDb.communityServiceActivity.findMany({
        where: { studentId, status: "APPROVED" },
        orderBy: { date: "desc" },
        take: 20,
      });
    }
    if (modules.includes("COMPETENCY")) {
      identity.competencies = await tDb.competencyEvidence.findMany({
        where: { studentId, approved: true, visibleToParents: true },
        include: { competency: true },
        orderBy: [{ evidenceDate: "desc" }, { createdAt: "desc" }],
        take: 60,
      });
    }
    if (modules.includes("DISCIPLINE")) {
      identity.discipline = await tDb.disciplineIncident.findMany({
        where: { studentId, status: "APPROVED" },
        orderBy: { date: "desc" },
        take: 30,
      });
    }
    if (modules.includes("MEDICAL")) {
      identity.medical = await tDb.studentMedical.findFirst({ where: { studentId } });
    }
    if (modules.includes("ATTENDANCE")) identity.attendance = student.attendance;
    if (modules.includes("PORTFOLIO")) identity.portfolio = student.portfolioItems;
    if (modules.includes("TALENT")) {
      const talents = await tDb.talentRecord.findMany({
        where: { studentId },
        include: { talentArea: true, coach: true },
        orderBy: { dateRecorded: "desc" },
        take: 20,
      });
      identity.talents = talents.map((row) => ({
        ...row,
        dateRecorded: row.dateRecorded.toISOString().slice(0, 10),
      }));
    }

    return identity;
  });
}

export async function initiateTransferPassport(user: SessionUser, input: TransferPassportRequestInput) {
  // J.22 — NEYO Ops can switch the compliance/transfer surface off platform-wide.
  await assertJFeatureEnabled("J.22");
  // J.22 — enforced ODPC lawful-basis + data-minimisation guard. This throws
  // ComplianceError if consent is missing or modules are invalid, so a transfer
  // can never be created without a lawful basis.
  const { lawfulModules } = assertLawfulTransferBasis({
    consentBy: input.consentBy,
    includedModules: input.includedModules,
  });
  input = { ...input, includedModules: lawfulModules as TransferPassportRequestInput["includedModules"] };
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const snapshot = await generateDigitalIdentitySnapshot(user, input.studentId, input.includedModules);
    const accessCode = crypto.randomBytes(6).toString("hex").toUpperCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const request = await tDb.transferPassportRequest.create({
      data: {
        sourceTenantId: user.tenantId,
        destinationTenantId: input.destinationTenantId || null,
        destinationEmail: input.destinationEmail || null,
        studentId: input.studentId,
        studentName: `${snapshot.profile.firstName} ${snapshot.profile.lastName}`,
        accessCode,
        expiresAt,
        status: "PENDING",
        includedModules: JSON.stringify(input.includedModules),
        consentBy: input.consentBy,
        consentDate: new Date(),
        payloadJson: JSON.stringify(snapshot),
      },
    });

    await writeAudit(user.tenantId, user.id, user.fullName, "compliance.transfer_passport_generated", request.id, {
      studentId: input.studentId,
      destination: input.destinationEmail || input.destinationTenantId || "Unknown",
      consentBy: input.consentBy,
      includedModules: input.includedModules,
      hasMedical: input.includedModules.includes("MEDICAL"),
      hasDiscipline: input.includedModules.includes("DISCIPLINE"),
    });

    return request;
  });
}

export async function getOutgoingTransfers(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().transferPassportRequest.findMany({
      where: { studentId },
      orderBy: { updatedAt: "desc" },
    });
  });
}

export async function getTransferPassportDetail(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const student = await tenantDb().student.findUnique({
      where: { id: studentId },
      include: { schoolClass: true, guardians: { include: { guardian: true } } },
    });
    if (!student) throw new DigitalIdentityError("NOT_FOUND", "Student not found.");
    const modules = ["ACADEMIC", "ATTENDANCE", "DISCIPLINE", "PORTFOLIO", "MEDICAL", "TALENT", "COMPETENCY"];
    const snapshot = await generateDigitalIdentitySnapshot(user, studentId, modules);
    return { student, snapshot };
  });
}

export async function exportTransferPassportPdf(user: SessionUser, studentId: string) {
  // J.22 — gate behind the Part-J feature toggle.
  await assertJFeatureEnabled("J.22");
  const { student, snapshot } = await getTransferPassportDetail(user, studentId);
  const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } });
  const buffer = await renderStudentTransferPassportPdf({
    tenant: {
      name: tenant?.name ?? "NEYO School",
      county: tenant?.county ?? null,
      addressLine: tenant?.addressLine ?? null,
      motto: tenant?.motto ?? null,
      brandPrimary: tenant?.brandPrimary ?? "#1c2740",
    },
    student: {
      fullName: [student.firstName, student.lastName].filter(Boolean).join(" "),
      admissionNo: student.admissionNo,
      upiNumber: student.upiNumber,
      className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      guardians: student.guardians.map((g) => ({ fullName: g.guardian.fullName, phone: g.guardian.phone })),
    },
    snapshot,
  });

  // J.22 — full audit trail for PDF exports (was previously unlogged).
  await writeAudit(user.tenantId, user.id, user.fullName, "compliance.transfer_passport_exported", studentId, {
    studentId,
    exportedByRole: user.role,
    includedModules: snapshot?.modules ?? [],
    format: "PDF",
  }, "Student");

  return buffer;
}

export async function redeemTransferPassport(user: SessionUser, input: TransferPassportRedeemInput) {
  return withTenant(user.tenantId, async () => {
    const request = await db.transferPassportRequest.findUnique({ where: { accessCode: input.accessCode }, include: { student: true, sourceTenant: true } });
    if (!request) throw new DigitalIdentityError("NOT_FOUND", "Passport not found.");
    if (request.destinationTenantId && request.destinationTenantId !== user.tenantId) {
      throw new DigitalIdentityError("FORBIDDEN", "This passport is not assigned to your school.");
    }
    if (request.status !== "PENDING") {
      throw new DigitalIdentityError("INVALID", `Passport is already ${request.status.toLowerCase()}.`);
    }
    if (request.expiresAt.getTime() < Date.now()) {
      await db.transferPassportRequest.update({ where: { id: request.id }, data: { status: "EXPIRED", lastAccessedAt: new Date() } });
      throw new DigitalIdentityError("EXPIRED", "Passport has expired.");
    }

    const payload = safeParseJson<any>(request.payloadJson, null);
    if (!payload) throw new DigitalIdentityError("INVALID", "Passport payload is unavailable.");

    const updated = await db.transferPassportRequest.update({
      where: { id: request.id },
      data: {
        destinationTenantId: request.destinationTenantId ?? user.tenantId,
        status: "COMPLETED",
        importedAt: new Date(),
        receivedById: user.id,
        receivedByName: user.fullName,
        lastAccessedAt: new Date(),
      },
    });

    await writeAudit(request.sourceTenantId, user.id, user.fullName, "compliance.transfer_passport_redeemed", request.id, {
      receivedByTenantId: user.tenantId,
      receivedById: user.id,
      receivedByName: user.fullName,
      studentId: request.studentId,
    });
    if (user.tenantId !== request.sourceTenantId) {
      await writeAudit(user.tenantId, user.id, user.fullName, "compliance.transfer_passport_imported", request.id, {
        sourceTenantId: request.sourceTenantId,
        studentId: request.studentId,
      });
    }

    return {
      request: updated,
      snapshot: payload,
      sourceSchool: request.sourceTenant?.name ?? null,
    };
  });
}
