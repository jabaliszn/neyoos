import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";
import { type CommunityServiceInput } from "@/lib/validations/community-service";

export class CommunityServiceError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "CommunityServiceError";
  }
}

export async function getStudentServiceActivities(user: SessionUser, studentId: string) {
  const activities = await tenantDb().communityServiceActivity.findMany({
    where: { studentId },
    orderBy: { date: "desc" }
  });

  const totalHours = activities.reduce((sum, act) => sum + (act.status === "APPROVED" ? act.hours : 0), 0);

  return {
    activities,
    totalHours
  };
}

export async function logServiceActivity(user: SessionUser, input: CommunityServiceInput) {
  const tDb = tenantDb();

  const student = await tDb.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new CommunityServiceError("NOT_FOUND", "Student not found");

  return tDb.communityServiceActivity.create({
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
      status: input.status,
    }
  });
}

export async function deleteServiceActivity(user: SessionUser, id: string) {
  const tDb = tenantDb();
  const existing = await tDb.communityServiceActivity.findUnique({ where: { id } });
  if (!existing) throw new CommunityServiceError("NOT_FOUND", "Activity not found");

  return tDb.communityServiceActivity.delete({ where: { id } });
}
