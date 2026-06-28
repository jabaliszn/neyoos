import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";
import { type TalentAreaInput, type TalentRecordInput } from "@/lib/validations/talents";

export class TalentError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "TalentError";
  }
}

// -- Talent Areas (Co-curricular setup) --

export async function getTalentAreas(user: SessionUser) {
  return tenantDb().talentArea.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { records: true } } },
  });
}

export async function createTalentArea(user: SessionUser, input: TalentAreaInput) {
  const tDb = tenantDb();
  const existing = await tDb.talentArea.findUnique({
    where: { tenantId_name: { tenantId: user.tenantId, name: input.name } },
  });
  if (existing) throw new TalentError("CONFLICT", "A talent area with this name already exists.");

  return tDb.talentArea.create({
    data: {
      tenantId: user.tenantId,
      name: input.name,
      category: input.category,
      description: input.description || null,
    }
  });
}

export async function updateTalentArea(user: SessionUser, id: string, input: TalentAreaInput) {
  const tDb = tenantDb();
  const existing = await tDb.talentArea.findUnique({ where: { id } });
  if (!existing) throw new TalentError("NOT_FOUND", "Talent area not found.");

  const nameConflict = await tDb.talentArea.findUnique({
    where: { tenantId_name: { tenantId: user.tenantId, name: input.name } },
  });
  if (nameConflict && nameConflict.id !== id) {
    throw new TalentError("CONFLICT", "A talent area with this name already exists.");
  }

  return tDb.talentArea.update({
    where: { id },
    data: {
      name: input.name,
      category: input.category,
      description: input.description || null,
    }
  });
}

export async function deleteTalentArea(user: SessionUser, id: string) {
  const tDb = tenantDb();
  const existing = await tDb.talentArea.findUnique({ 
    where: { id },
    include: { _count: { select: { records: true } } }
  });
  if (!existing) throw new TalentError("NOT_FOUND", "Talent area not found.");
  if (existing._count.records > 0) throw new TalentError("CONFLICT", "Cannot delete area with existing records.");

  return tDb.talentArea.delete({ where: { id } });
}


// -- Talent Records (Evaluation & Tracking) --

export async function getStudentTalentRecords(user: SessionUser, studentId: string) {
  return tenantDb().talentRecord.findMany({
    where: { studentId },
    include: {
      talentArea: true,
      term: true,
      coach: { select: { id: true, fullName: true } }
    },
    orderBy: { dateRecorded: "desc" }
  });
}

export async function recordStudentTalent(user: SessionUser, input: TalentRecordInput) {
  const tDb = tenantDb();
  
  // Verify student & area
  const student = await tDb.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new TalentError("NOT_FOUND", "Student not found.");
  
  const area = await tDb.talentArea.findUnique({ where: { id: input.talentAreaId } });
  if (!area) throw new TalentError("NOT_FOUND", "Talent area not found.");

  return tDb.talentRecord.create({
    data: {
      tenantId: user.tenantId,
      studentId: input.studentId,
      talentAreaId: input.talentAreaId,
      termId: input.termId || null,
      coachId: user.id, // Current logged in user is the coach/teacher
      score: input.score || null,
      notes: input.notes || null,
      portfolioItemId: input.portfolioItemId || null,
    },
    include: { talentArea: true, coach: { select: { fullName: true } } }
  });
}

export async function deleteTalentRecord(user: SessionUser, id: string) {
  const tDb = tenantDb();
  const record = await tDb.talentRecord.findUnique({ where: { id } });
  if (!record) throw new TalentError("NOT_FOUND", "Record not found.");
  
  // Optional: Rule—Only the coach who recorded it, or an admin, can delete.
  // Assuming requirePermission guards are up at the API level, we proceed.

  return tDb.talentRecord.delete({ where: { id } });
}
