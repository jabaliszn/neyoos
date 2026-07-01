import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import type { CommunityServiceDecisionInput, CommunityServiceInput } from "@/lib/validations/community-service";

export class CommunityServiceError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "CommunityServiceError";
  }
}

async function audit(user: SessionUser, action: string, entityId: string, metadata: Record<string, unknown>) {
  try {
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action,
        entityType: "CommunityServiceActivity",
        entityId,
        metadata: JSON.stringify(metadata),
      },
    });
  } catch {}
}

export async function getStudentServiceActivities(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const [activities, student] = await Promise.all([
      tenantDb().communityServiceActivity.findMany({ where: { studentId }, orderBy: { date: "desc" } }),
      tenantDb().student.findUnique({ where: { id: studentId }, include: { schoolClass: true } }),
    ]);
    if (!student) throw new CommunityServiceError("NOT_FOUND", "Student not found.");

    const totalHours = activities.reduce((sum, act) => sum + (act.status === "APPROVED" ? act.hours : 0), 0);
    return {
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo,
        className: student.schoolClass ? `${student.schoolClass.level}${student.schoolClass.stream ? ` ${student.schoolClass.stream}` : ""}` : null,
      },
      activities,
      totalHours,
      approvedCount: activities.filter((a) => a.status === "APPROVED").length,
    };
  });
}

export async function logServiceActivity(user: SessionUser, input: CommunityServiceInput) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const student = await tDb.student.findUnique({ where: { id: input.studentId } });
    if (!student) throw new CommunityServiceError("NOT_FOUND", "Student not found");

    if (input.proofFileId) {
      const storedFile = await tDb.storedFile.findUnique({ where: { id: input.proofFileId } });
      if (!storedFile || !storedFile.encrypted) throw new CommunityServiceError("INVALID", "Evidence must use the encrypted Storage Vault.");
    }
    if (input.competencyId) {
      const competency = await tDb.competency.findUnique({ where: { id: input.competencyId } });
      if (!competency) throw new CommunityServiceError("INVALID", "Competency not found.");
    }

    const created = await tDb.communityServiceActivity.create({
      data: {
        tenantId: user.tenantId,
        studentId: input.studentId,
        title: input.title,
        category: input.category,
        date: input.date,
        hours: input.hours,
        location: input.location || null,
        supervisorName: input.supervisorName || null,
        supervisorPhone: input.supervisorPhone || null,
        studentReflection: input.studentReflection || null,
        proofFileId: input.proofFileId || null,
        status: input.status,
      },
    });
    await audit(user, "community_service.logged", created.id, { studentId: input.studentId, status: created.status, competencyId: input.competencyId || null });

    if (created.status === "APPROVED" && input.competencyId) {
      await tDb.competencyEvidence.create({
        data: {
          tenantId: user.tenantId,
          competencyId: input.competencyId,
          studentId: input.studentId,
          sourceModule: "COMMUNITY",
          sourceId: created.id,
          level: 3,
          narrative: input.studentReflection || `Community service: ${input.title}`,
          evidenceDate: input.date,
          recordedById: user.id,
          recordedByName: user.fullName,
          approved: true,
          visibleToParents: true,
        },
      });
    }

    return created;
  });
}

export async function decideServiceActivity(user: SessionUser, input: CommunityServiceDecisionInput) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const existing = await tDb.communityServiceActivity.findUnique({ where: { id: input.id } });
    if (!existing) throw new CommunityServiceError("NOT_FOUND", "Activity not found");

    const updated = await tDb.communityServiceActivity.update({ where: { id: input.id }, data: { status: input.status } });
    await audit(user, `community_service.${input.status.toLowerCase()}`, updated.id, { studentId: updated.studentId, competencyId: input.competencyId || null });

    if (input.status === "APPROVED" && input.competencyId) {
      const competency = await tDb.competency.findUnique({ where: { id: input.competencyId } });
      if (!competency) throw new CommunityServiceError("INVALID", "Competency not found.");
      const existingEvidence = await tDb.competencyEvidence.findFirst({ where: { sourceModule: "COMMUNITY", sourceId: updated.id } });
      if (!existingEvidence) {
        await tDb.competencyEvidence.create({
          data: {
            tenantId: user.tenantId,
            competencyId: input.competencyId,
            studentId: updated.studentId,
            sourceModule: "COMMUNITY",
            sourceId: updated.id,
            level: 3,
            narrative: updated.studentReflection || `Community service: ${updated.title}`,
            evidenceDate: updated.date,
            recordedById: user.id,
            recordedByName: user.fullName,
            approved: true,
            visibleToParents: true,
          },
        });
      }
    }

    return updated;
  });
}

export async function deleteServiceActivity(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const existing = await tDb.communityServiceActivity.findUnique({ where: { id } });
    if (!existing) throw new CommunityServiceError("NOT_FOUND", "Activity not found");
    await tDb.competencyEvidence.deleteMany({ where: { sourceModule: "COMMUNITY", sourceId: id } });
    await tDb.communityServiceActivity.delete({ where: { id } });
    await audit(user, "community_service.deleted", id, { studentId: existing.studentId });
    return { ok: true };
  });
}

export async function buildCommunityServiceReport(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const [tenant, summary] = await Promise.all([
      db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } }),
      getStudentServiceActivities(user, studentId),
    ]);
    return { tenant, summary };
  });
}
