import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";

export async function getAdvancedAnalytics(user: SessionUser) {
  const tDb = tenantDb();
  
  // 1. Attendance to Performance Correlation
  // We'll get average exam score per student vs their absence count
  const students = await tDb.student.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      schoolClass: { select: { level: true, stream: true } },
      _count: { select: { attendance: { where: { status: "A" } } } },
      examResults: { select: { marks: true, exam: { select: { maxMarks: true } } } }
    }
  });

  const correlationData = students.map(s => {
    const abs = s._count.attendance;
    let avgScore = 0;
    if (s.examResults.length > 0) {
      const validResults = s.examResults.filter(r => r.marks !== null && r.exam?.maxMarks);
      if (validResults.length > 0) {
        avgScore = validResults.reduce((sum, r) => sum + ((r.marks! / r.exam.maxMarks) * 100), 0) / validResults.length;
      }
    }
    return {
      name: \`\${s.firstName} \${s.lastName}\`,
      class: s.schoolClass ? \`\${s.schoolClass.level} \${s.schoolClass.stream || ""}\`.trim() : "Unknown",
      absences: abs,
      avgScorePct: Math.round(avgScore * 10) / 10
    };
  }).filter(s => s.avgScorePct > 0); // Only include students with exam data

  // Group to see trend (e.g. 0-2 absences, 3-5 absences, 6+ absences)
  const attendanceTrend = [
    { bracket: "0-2 Absences", avgScore: 0, count: 0 },
    { bracket: "3-5 Absences", avgScore: 0, count: 0 },
    { bracket: "6+ Absences", avgScore: 0, count: 0 },
  ];

  correlationData.forEach(s => {
    let b = 0;
    if (s.absences > 2 && s.absences <= 5) b = 1;
    else if (s.absences > 5) b = 2;
    attendanceTrend[b].avgScore += s.avgScorePct;
    attendanceTrend[b].count++;
  });

  attendanceTrend.forEach(t => {
    if (t.count > 0) t.avgScore = Math.round(t.avgScore / t.count);
  });

  // 2. Assessment Balance (Exams vs Projects vs Portfolios)
  // How many formal exams vs flexible assessments vs portfolio evidence
  const examCount = await tDb.exam.count();
  const flexCount = await tDb.assessmentPlan.count();
  const portfolioCount = await tDb.portfolioItem.count({ where: { isApproved: true } });

  const assessmentBalance = [
    { label: "Formal Exams", value: examCount, color: "blue" },
    { label: "Flexible/Projects", value: flexCount, color: "purple" },
    { label: "Portfolio Items", value: portfolioCount, color: "amber" }
  ];

  // 3. Talent Participation & Wellbeing
  const talents = await tDb.talentRecord.groupBy({
    by: ['talentAreaId'],
    _count: { studentId: true }
  });
  
  const talentAreas = await tDb.talentArea.findMany({ select: { id: true, name: true, category: true } });
  const talentMap = new Map(talentAreas.map(t => [t.id, t.name]));
  const categoryMap = new Map(talentAreas.map(t => [t.id, t.category]));
  
  const talentParticipation = talents.map(t => ({
    name: talentMap.get(t.talentAreaId) || "Unknown",
    category: categoryMap.get(t.talentAreaId) || "OTHER",
    count: t._count.studentId
  })).sort((a, b) => b.count - a.count).slice(0, 5); // Top 5

  // 4. Competency Gaps (Areas where rubric levels are mostly 1 or 2)
  const compEvidence = await tDb.competencyEvidence.findMany({
    where: { level: { in: [1, 2] } }, // 1=BE, 2=AE (below/approaching expectations)
    include: { competency: true }
  });

  const gapCounts: Record<string, { name: string, count: number }> = {};
  compEvidence.forEach(e => {
    if (!gapCounts[e.competencyId]) gapCounts[e.competencyId] = { name: e.competency.name, count: 0 };
    gapCounts[e.competencyId].count++;
  });

  const competencyGaps = Object.values(gapCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 5. Principal Intervention Cards
  // Detect systemic issues requiring immediate attention
  const interventions = [];

  // If high absence group is failing relative to low absence group
  if (attendanceTrend[2].count > 5 && attendanceTrend[0].avgScore - attendanceTrend[2].avgScore > 15) {
    interventions.push({
      type: "ATTENDANCE_RISK",
      title: "Chronic Absenteeism Impacting Grades",
      description: \`Students with 6+ absences are averaging \${attendanceTrend[2].avgScore}% compared to \${attendanceTrend[0].avgScore}% for regular attenders. Intervention required.\`
    });
  }

  // If exam heavy
  const totalAssess = examCount + flexCount;
  if (totalAssess > 0 && examCount / totalAssess > 0.8) {
    interventions.push({
      type: "ASSESSMENT_IMBALANCE",
      title: "Over-reliance on Formal Exams",
      description: \`\${Math.round((examCount / totalAssess) * 100)}% of tracked assessments are formal exams. CBC guidelines recommend increased use of formative and project-based evaluation.\`
    });
  }

  if (competencyGaps.length > 0 && competencyGaps[0].count > 10) {
     interventions.push({
      type: "COMPETENCY_GAP",
      title: "Systemic Competency Gap Detected",
      description: \`\${competencyGaps[0].count} recent evaluations mark students Below or Approaching Expectations in "\${competencyGaps[0].name}". Teacher support may be needed.\`
    });
  }

  return {
    attendanceTrend,
    assessmentBalance,
    talentParticipation,
    competencyGaps,
    interventions
  };
}
