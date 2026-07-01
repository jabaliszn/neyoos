import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";

export class EcosystemTrendsError extends Error {
  constructor(public code: "FORBIDDEN", message: string) {
    super(message);
    this.name = "EcosystemTrendsError";
  }
}

function assertFounderOps(user: SessionUser) {
  if (user.role !== "SUPER_ADMIN") {
    throw new EcosystemTrendsError("FORBIDDEN", "Only NEYO Ops can access global trends.");
  }
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export async function getAnonymousEducationTrends(user: SessionUser) {
  assertFounderOps(user);

  const [
    totalSchools,
    totalStudents,
    totalAttendanceRecords,
    absentRecords,
    competencyTotal,
    competencyStruggling,
    competencyMeeting,
    totalTalentRecords,
    communityHours,
    portfolioApproved,
    assessmentPlans,
    pathwayAllocations,
    activityCategories,
  ] = await Promise.all([
    db.tenant.count(),
    db.student.count({ where: { status: "ACTIVE" } }),
    db.attendanceRecord.count(),
    db.attendanceRecord.count({ where: { status: "A" } }),
    db.competencyEvidence.count({ where: { approved: true } }),
    db.competencyEvidence.count({ where: { approved: true, level: { in: [1, 2] } } }),
    db.competencyEvidence.count({ where: { approved: true, level: { in: [3, 4] } } }),
    db.talentRecord.count(),
    db.communityServiceActivity.aggregate({ _sum: { hours: true }, where: { status: "APPROVED" } }),
    db.portfolioItem.count({ where: { status: "APPROVED" } }),
    db.assessmentPlan.count(),
    db.studentPathwayPreference.groupBy({ by: ["pathwayId"], _count: { pathwayId: true }, where: { isAllocated: true } }),
    db.activityCategory.findMany({ select: { name: true } }),
  ]);

  const globalAttendanceRate = totalAttendanceRecords > 0
    ? Math.round(((totalAttendanceRecords - absentRecords) / totalAttendanceRecords) * 100)
    : 0;

  const pathwayRows = await db.pathway.findMany({ select: { id: true, code: true, name: true } });
  const pathwayMap = new Map(pathwayRows.map((p) => [p.id, { code: p.code, name: p.name }]));
  const popularPathways = pathwayAllocations
    .map((row) => {
      const found = pathwayMap.get(row.pathwayId);
      return {
        code: found?.code || "PATHWAY",
        label: found?.name || "Unknown pathway",
        count: row._count.pathwayId,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const clubKeywords = ["club", "stem", "music", "drama", "sports", "games", "agriculture", "community"];
  const clubDistributionMap = new Map<string, number>();
  for (const row of activityCategories) {
    const lower = row.name.toLowerCase();
    const match = clubKeywords.find((k) => lower.includes(k));
    const key = match ? match.toUpperCase() : "OTHER";
    clubDistributionMap.set(key, (clubDistributionMap.get(key) || 0) + 1);
  }
  const clubs = [...clubDistributionMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    adoption: {
      totalSchools,
      totalStudents,
    },
    attendance: {
      globalAttendanceRate,
      recordsAnalyzed: totalAttendanceRecords,
      absentPct: pct(absentRecords, totalAttendanceRecords),
    },
    competencies: {
      totalEvaluations: competencyTotal,
      strugglingPct: pct(competencyStruggling, competencyTotal),
      meetingPct: pct(competencyMeeting, competencyTotal),
    },
    pathways: popularPathways,
    coCurricular: {
      totalTalentRecords,
      globalCommunityServiceHours: communityHours._sum.hours || 0,
      clubCategoryDistribution: clubs,
    },
    ecosystem: {
      approvedPortfolioItems: portfolioApproved,
      assessmentPlans,
    },
    privacy: {
      mode: "ANONYMOUS_AGGREGATE_ONLY",
      returnsSchoolNames: false,
      returnsLearnerNames: false,
    },
  };
}
