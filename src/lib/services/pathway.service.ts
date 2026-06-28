import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";
import { type PathwayInput, type StudentPathwayPreferenceInput, type StudentPathwayAllocationInput } from "@/lib/validations/pathways";

export class PathwayError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "PathwayError";
  }
}

export async function getPathways(user: SessionUser) {
  const tDb = tenantDb();
  return tDb.pathway.findMany({
    include: {
      subjectRequirements: {
        include: { subject: true },
      },
      _count: { select: { studentPreferences: { where: { isAllocated: true } } } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createPathway(user: SessionUser, input: PathwayInput) {
  const tDb = tenantDb();
  
  const existing = await tDb.pathway.findUnique({
    where: { tenantId_code: { tenantId: user.tenantId, code: input.code } },
  });
  if (existing) throw new PathwayError("CONFLICT", "A pathway with this code already exists.");

  return tDb.pathway.create({
    data: {
      tenantId: user.tenantId,
      name: input.name,
      code: input.code,
      description: input.description || null,
      capacity: input.capacity || null,
      subjectRequirements: {
        create: input.requirements?.map(req => ({
          tenantId: user.tenantId,
          subjectId: req.subjectId,
          isCore: req.isCore,
          minScorePct: req.minScorePct || null,
        })) || []
      }
    },
    include: { subjectRequirements: true }
  });
}

export async function updatePathway(user: SessionUser, id: string, input: PathwayInput) {
  const tDb = tenantDb();
  
  const existing = await tDb.pathway.findUnique({ where: { id } });
  if (!existing) throw new PathwayError("NOT_FOUND", "Pathway not found.");

  // For simplicity, we drop and recreate requirements
  await tDb.pathwaySubjectRequirement.deleteMany({ where: { pathwayId: id } });

  return tDb.pathway.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code,
      description: input.description || null,
      capacity: input.capacity || null,
      subjectRequirements: {
        create: input.requirements?.map(req => ({
          tenantId: user.tenantId,
          subjectId: req.subjectId,
          isCore: req.isCore,
          minScorePct: req.minScorePct || null,
        })) || []
      }
    },
    include: { subjectRequirements: { include: { subject: true } } }
  });
}

export async function deletePathway(user: SessionUser, id: string) {
  const tDb = tenantDb();
  
  const existing = await tDb.pathway.findUnique({ 
    where: { id },
    include: { _count: { select: { studentPreferences: true } } }
  });
  if (!existing) throw new PathwayError("NOT_FOUND", "Pathway not found.");

  if (existing._count.studentPreferences > 0) {
    throw new PathwayError("CONFLICT", "Cannot delete pathway with existing student preferences or allocations.");
  }

  return tDb.pathway.delete({ where: { id } });
}

// Preference & Allocation Management
export async function getStudentPreferences(user: SessionUser, studentId: string) {
  return tenantDb().studentPathwayPreference.findMany({
    where: { studentId },
    include: { pathway: true },
    orderBy: { choiceOrder: "asc" }
  });
}

export async function setStudentPreferences(user: SessionUser, studentId: string, preferences: StudentPathwayPreferenceInput[]) {
  const tDb = tenantDb();
  // Clear old preferences that are NOT YET allocated
  await tDb.studentPathwayPreference.deleteMany({
    where: { studentId, isAllocated: false }
  });

  for (const pref of preferences) {
    await tDb.studentPathwayPreference.upsert({
      where: { tenantId_studentId_pathwayId: { tenantId: user.tenantId, studentId, pathwayId: pref.pathwayId } },
      create: {
        tenantId: user.tenantId,
        studentId,
        pathwayId: pref.pathwayId,
        choiceOrder: pref.choiceOrder,
      },
      update: {
        choiceOrder: pref.choiceOrder,
      }
    });
  }

  return getStudentPreferences(user, studentId);
}

export async function allocateStudentToPathway(user: SessionUser, studentId: string, input: StudentPathwayAllocationInput) {
  const tDb = tenantDb();
  
  // Reset other allocations for this student to false
  await tDb.studentPathwayPreference.updateMany({
    where: { studentId, isAllocated: true },
    data: { isAllocated: false }
  });

  return tDb.studentPathwayPreference.upsert({
    where: { tenantId_studentId_pathwayId: { tenantId: user.tenantId, studentId, pathwayId: input.pathwayId } },
    create: {
      tenantId: user.tenantId,
      studentId,
      pathwayId: input.pathwayId,
      choiceOrder: 1, // Defaulting if they didn't pick it
      isAllocated: input.isAllocated,
      isRecommended: input.isRecommended,
      teacherNotes: input.teacherNotes || null,
    },
    update: {
      isAllocated: input.isAllocated,
      isRecommended: input.isRecommended,
      teacherNotes: input.teacherNotes || null,
    }
  });
}
