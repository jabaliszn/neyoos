import { db } from "@/lib/db";
import { SessionUser } from "@/lib/core/session";

export async function getAnonymousEducationTrends(user: SessionUser) {
  if (user.role !== "SUPER_ADMIN") {
    throw new Error("FORBIDDEN: Only NEYO Ops can access global trends.");
  }

  // 1. Global Platform Adoption
  const totalSchools = await db.tenant.count();
  const totalStudents = await db.student.count({ where: { status: "ACTIVE" } });
  
  // 2. Most Popular Senior School Pathways
  const pathwayAllocations = await db.studentPathwayPreference.groupBy({
    by: ['pathwayId'],
    _count: { studentId: true },
    where: { isAllocated: true }
  });
  
  // Resolve pathway names (anonymized, grouping by code/name)
  const pathways = await db.pathway.findMany({ select: { id: true, name: true, code: true } });
  const pathwayMap = new Map(pathways.map(p => [p.id, p.name]));
  
  const popularPathways = pathwayAllocations
    .map(p => ({
      name: pathwayMap.get(p.pathwayId) || "Unknown",
      count: p._count.studentId
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 3. Global Attendance Averages
  const totalAttendanceRecords = await db.attendanceRecord.count();
  const absentRecords = await db.attendanceRecord.count({ where: { status: "A" } });
  const globalAttendanceRate = totalAttendanceRecords > 0 
    ? Math.round(((totalAttendanceRecords - absentRecords) / totalAttendanceRecords) * 100) 
    : 0;

  // 4. Competency Health (Global)
  // How many evaluations are Below/Approaching vs Meeting/Exceeding
  const competencyTotal = await db.competencyEvidence.count();
  const competencyStruggling = await db.competencyEvidence.count({ where: { level: { in: [1, 2] } } });
  const competencyMeeting = await db.competencyEvidence.count({ where: { level: { in: [3, 4] } } });

  // 5. Co-Curricular Engagement
  const totalTalentRecords = await db.talentRecord.count();
  const totalCommunityServiceHoursRes = await db.communityServiceActivity.aggregate({
    _sum: { hours: true },
    where: { status: "APPROVED" }
  });
  const globalCommunityServiceHours = totalCommunityServiceHoursRes._sum.hours || 0;

  return {
    adoption: {
      totalSchools,
      totalStudents,
    },
    attendance: {
      globalAttendanceRate,
      recordsAnalyzed: totalAttendanceRecords,
    },
    competencies: {
      totalEvaluations: competencyTotal,
      strugglingPct: competencyTotal > 0 ? Math.round((competencyStruggling / competencyTotal) * 100) : 0,
      meetingPct: competencyTotal > 0 ? Math.round((competencyMeeting / competencyTotal) * 100) : 0,
    },
    pathways: popularPathways,
    coCurricular: {
      totalTalentRecords,
      globalCommunityServiceHours
    }
  };
}
