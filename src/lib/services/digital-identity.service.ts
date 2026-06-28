import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";
import { cryptoRandomStringAsync } from "@/lib/utils";

// 1. Build the Digital Identity Snapshot
export async function generateDigitalIdentitySnapshot(user: SessionUser, studentId: string, modules: string[]) {
  const tDb = tenantDb();
  const student = await tDb.student.findUnique({
    where: { id: studentId },
    include: {
      guardians: { include: { guardian: true } },
      schoolClass: true,
      attendance: modules.includes("ATTENDANCE") ? { take: 50, orderBy: { date: "desc" } } : false,
      portfolioItems: modules.includes("PORTFOLIO") ? { where: { isApproved: true } } : false,
      talentRecords: modules.includes("TALENT") ? { include: { talentArea: true } } : false,
    }
  });

  if (!student) throw new Error("Student not found");

  const identity: any = {
    profile: {
      admissionNo: student.admissionNo,
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      upiNumber: student.upiNumber,
      guardians: student.guardians.map(g => g.guardian.fullName)
    }
  };

  if (modules.includes("ACADEMIC")) {
    identity.academics = await tDb.examResult.findMany({ where: { studentId }, include: { exam: true, subject: true }, take: 100 });
  }
  if (modules.includes("COMPETENCY")) {
    identity.competencies = await tDb.competencyEvidence.findMany({ where: { studentId, visibleToParents: true }, include: { competency: true } });
  }
  if (modules.includes("DISCIPLINE")) {
    identity.discipline = await tDb.disciplineIncident.findMany({ where: { studentId, status: "CLOSED" } });
  }
  if (modules.includes("MEDICAL")) {
    identity.medical = await tDb.medicalProfile.findUnique({ where: { studentId } });
  }
  if (modules.includes("ATTENDANCE")) identity.attendance = student.attendance;
  if (modules.includes("PORTFOLIO")) identity.portfolio = student.portfolioItems;
  if (modules.includes("TALENT")) identity.talents = student.talentRecords;

  return identity;
}

// 2. Transfer Passport Orchestration
export async function initiateTransferPassport(user: SessionUser, input: any) {
  const tDb = tenantDb();
  
  // Create JSON snapshot payload
  const snapshot = await generateDigitalIdentitySnapshot(user, input.studentId, input.includedModules);

  // Generate secure code (e.g. 8 digits)
  const accessCode = Math.random().toString().slice(2, 10);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14); // 14 days valid

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
      payloadJson: JSON.stringify(snapshot),
    }
  });

  // J.22 Compliance Audit Log (Data Protection Act / ODPC requirement)
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "compliance.transfer_passport_generated",
      entityType: "TransferPassportRequest",
      entityId: request.id,
      metadata: JSON.stringify({
        studentId: input.studentId,
        destination: input.destinationEmail || input.destinationTenantId || "Unknown",
        consentBy: input.consentBy,
        includedModules: input.includedModules,
        hasMedical: input.includedModules.includes("MEDICAL"),
        hasDiscipline: input.includedModules.includes("DISCIPLINE"),
      })
    }
  });

  return request;
}

export async function getOutgoingTransfers(user: SessionUser, studentId: string) {
  return tenantDb().transferPassportRequest.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" }
  });
}
