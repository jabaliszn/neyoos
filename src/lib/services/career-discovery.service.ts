import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";
import { type CareerDiscoveryInput } from "@/lib/validations/career-discovery";

export class CareerDiscoveryError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "CareerDiscoveryError";
  }
}

export async function getStudentCareerRecords(user: SessionUser, studentId: string) {
  return tenantDb().careerDiscoveryRecord.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" }
  });
}

export async function logCareerRecord(user: SessionUser, input: CareerDiscoveryInput) {
  const tDb = tenantDb();

  const student = await tDb.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new CareerDiscoveryError("NOT_FOUND", "Student not found");

  return tDb.careerDiscoveryRecord.create({
    data: {
      tenantId: user.tenantId,
      studentId: input.studentId,
      recordType: input.recordType,
      careerArea: input.careerArea || null,
      notes: input.notes,
      recordedById: user.id,
      recordedByName: user.fullName
    }
  });
}

export async function deleteCareerRecord(user: SessionUser, id: string) {
  const tDb = tenantDb();
  const existing = await tDb.careerDiscoveryRecord.findUnique({ where: { id } });
  if (!existing) throw new CareerDiscoveryError("NOT_FOUND", "Record not found");

  // Only the creator or an admin should delete
  if (existing.recordedById !== user.id && !["PRINCIPAL", "DEPUTY_PRINCIPAL", "SUPER_ADMIN"].includes(user.role)) {
    throw new CareerDiscoveryError("FORBIDDEN", "Not allowed to delete this record");
  }

  return tDb.careerDiscoveryRecord.delete({ where: { id } });
}
