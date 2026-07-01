import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

function avg(nums: number[]) {
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0;
}

export async function getAdvancedAnalytics(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();

    const [
      students,
      exams,
      examResults,
      classNeeds,
      competencies,
      weakCompetencyEvidence,
      examCount,
      assessmentPlanCount,
      approvedPortfolioCount,
      talentAreas,
      talentRecords,
      studentMedicalCount,
      counselingCount,
      clinicVisitCount,
      pathways,
      pathwayPreferences,
    ] = await Promise.all([
      tDb.student.findMany({
        where: { status: "ACTIVE" },
        include: {
          schoolClass: true,
          attendance: true,
        },
      }),
      tDb.exam.findMany(),
      tDb.examResult.findMany(),
      tDb.classSubjectNeed.findMany(),
      tDb.competency.findMany({ include: { group: true } }),
      tDb.competencyEvidence.findMany({
        where: { level: { in: [1, 2] } },
        include: {
          competency: true,
        },
      }),
      tDb.exam.count(),
      tDb.assessmentPlan.count(),
      tDb.portfolioItem.count({ where: { status: "APPROVED" } }),
      tDb.talentArea.findMany(),
      tDb.talentRecord.findMany({ include: { talentArea: true, student: true } }),
      tDb.studentMedical.count(),
      tDb.counselingNote.count(),
      tDb.clinicVisit.count(),
      tDb.pathway.findMany({ include: { _count: { select: { studentPreferences: { where: { isAllocated: true } } } } } }),
      tDb.studentPathwayPreference.findMany({ where: { isAllocated: true }, include: { pathway: true, student: { include: { schoolClass: true } } } }),
    ]);

    const examMap = new Map(exams.map((e) => [e.id, e]));
    const teacherByClassSubject = new Map(classNeeds.map((n) => [`${n.classId}:${n.subjectId}`, n.teacherId || ""]));
    const competencyMap = new Map(competencies.map((c) => [c.id, c]));

    const studentScoreMap = new Map<string, number[]>();
    for (const row of examResults) {
      const exam = examMap.get(row.examId);
      if (!exam) continue;
      const pct = Math.round((row.marks / Math.max(1, exam.maxMarks)) * 100);
      if (!studentScoreMap.has(row.studentId)) studentScoreMap.set(row.studentId, []);
      studentScoreMap.get(row.studentId)!.push(pct);
    }

    const correlationData = students.map((s) => {
      const absences = s.attendance.filter((a) => a.status === "A").length;
      const scores = studentScoreMap.get(s.id) || [];
      return {
        studentId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        class: s.schoolClass ? `${s.schoolClass.level} ${s.schoolClass.stream || ""}`.trim() : "Unknown",
        absences,
        avgScorePct: avg(scores),
      };
    }).filter((s) => s.avgScorePct > 0);

    const attendanceTrend = [
      { bracket: "0-2 Absences", avgScore: 0, count: 0 },
      { bracket: "3-5 Absences", avgScore: 0, count: 0 },
      { bracket: "6+ Absences", avgScore: 0, count: 0 },
    ];
    correlationData.forEach((s) => {
      let idx = 0;
      if (s.absences > 2 && s.absences <= 5) idx = 1;
      else if (s.absences > 5) idx = 2;
      attendanceTrend[idx].avgScore += s.avgScorePct;
      attendanceTrend[idx].count += 1;
    });
    attendanceTrend.forEach((b) => {
      if (b.count > 0) b.avgScore = Math.round(b.avgScore / b.count);
    });

    const assessmentBalance = [
      { label: "Formal Exams", value: examCount, color: "blue" },
      { label: "Flexible/Projects", value: assessmentPlanCount, color: "purple" },
      { label: "Portfolio Items", value: approvedPortfolioCount, color: "amber" },
    ];

    const talentCountByArea = new Map<string, { name: string; category: string; count: number }>();
    for (const area of talentAreas) talentCountByArea.set(area.id, { name: area.name, category: area.category, count: 0 });
    for (const row of talentRecords) {
      const current = talentCountByArea.get(row.talentAreaId);
      if (current) current.count += 1;
    }
    const talentParticipation = [...talentCountByArea.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    const weakOverall = new Map<string, { name: string; count: number }>();
    const weakByClass = new Map<string, { label: string; count: number }>();
    const weakByGrade = new Map<string, { label: string; count: number }>();
    const weakBySubject = new Map<string, { label: string; count: number }>();
    const weakByTeacher = new Map<string, { label: string; count: number }>();

    const studentById = new Map(students.map((s) => [s.id, s]));
    for (const e of weakCompetencyEvidence) {
      const comp = competencyMap.get(e.competencyId);
      const student = studentById.get(e.studentId);
      const classLabel = student?.schoolClass ? `${student.schoolClass.level} ${student.schoolClass.stream || ""}`.trim() : "Unknown class";
      const gradeLabel = student?.schoolClass?.level || "Unknown grade";
      const subjectLabel = comp?.group?.name || comp?.name || "Unknown subject";
      const teacherLabel = e.recordedByName || "Unknown teacher";

      weakOverall.set(e.competencyId, { name: e.competency.name, count: (weakOverall.get(e.competencyId)?.count || 0) + 1 });
      weakByClass.set(classLabel, { label: classLabel, count: (weakByClass.get(classLabel)?.count || 0) + 1 });
      weakByGrade.set(gradeLabel, { label: gradeLabel, count: (weakByGrade.get(gradeLabel)?.count || 0) + 1 });
      weakBySubject.set(subjectLabel, { label: subjectLabel, count: (weakBySubject.get(subjectLabel)?.count || 0) + 1 });
      weakByTeacher.set(teacherLabel, { label: teacherLabel, count: (weakByTeacher.get(teacherLabel)?.count || 0) + 1 });
    }

    const competencyGaps = {
      overall: [...weakOverall.values()].sort((a, b) => b.count - a.count).slice(0, 5),
      byClass: [...weakByClass.values()].sort((a, b) => b.count - a.count).slice(0, 5),
      byGrade: [...weakByGrade.values()].sort((a, b) => b.count - a.count).slice(0, 5),
      bySubject: [...weakBySubject.values()].sort((a, b) => b.count - a.count).slice(0, 5),
      byTeacher: [...weakByTeacher.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    };

    const totalStudents = students.length || 1;
    const studentsWithTalent = new Set(talentRecords.map((t) => t.studentId)).size;
    const wellbeingIndicators = {
      participationPct: Math.round((studentsWithTalent / totalStudents) * 100),
      medicalProfiles: studentMedicalCount,
      counselingNotes: counselingCount,
      clinicVisits: clinicVisitCount,
      riskFlag: attendanceTrend[2].count > 0 || counselingCount > 0 || clinicVisitCount > 0,
    };

    const pathwayReadiness = pathways.map((p) => {
      const rows = pathwayPreferences.filter((pref) => pref.pathwayId === p.id);
      const allocatedCount = rows.length;
      const capacity = p.capacity ?? null;
      const seatsLeft = capacity != null ? Math.max(0, capacity - allocatedCount) : null;
      return {
        pathwayName: p.name,
        pathwayCode: p.code,
        allocatedCount,
        capacity,
        seatsLeft,
        fillPct: capacity ? Math.round((allocatedCount / capacity) * 100) : null,
      };
    }).sort((a, b) => b.allocatedCount - a.allocatedCount);

    const interventions: Array<{ type: string; title: string; description: string }> = [];
    if (attendanceTrend[2].count > 0 && attendanceTrend[0].count > 0 && attendanceTrend[0].avgScore - attendanceTrend[2].avgScore > 15) {
      interventions.push({
        type: "ATTENDANCE_RISK",
        title: "Chronic absenteeism is dragging performance down",
        description: `Learners with 6+ absences average ${attendanceTrend[2].avgScore}% versus ${attendanceTrend[0].avgScore}% for regular attenders.`,
      });
    }
    const totalAssessments = examCount + assessmentPlanCount;
    if (totalAssessments > 0 && examCount / totalAssessments > 0.8) {
      interventions.push({
        type: "ASSESSMENT_IMBALANCE",
        title: "Assessment mix is too exam-heavy",
        description: `${Math.round((examCount / totalAssessments) * 100)}% of tracked assessments are formal exams. Add more flexible, project or portfolio-based evidence.`,
      });
    }
    if (competencyGaps.overall[0]?.count > 10) {
      interventions.push({
        type: "COMPETENCY_GAP",
        title: "Systemic weak competency detected",
        description: `${competencyGaps.overall[0].count} weak evaluations are concentrated in ${competencyGaps.overall[0].name}.`,
      });
    }
    if (wellbeingIndicators.riskFlag) {
      interventions.push({
        type: "WELLBEING_SIGNAL",
        title: "Wellbeing indicators need leadership attention",
        description: `${wellbeingIndicators.clinicVisits} clinic visits, ${wellbeingIndicators.counselingNotes} counseling notes and ${100 - wellbeingIndicators.participationPct}% non-participation in talent activities suggest follow-up is needed.`,
      });
    }

    return {
      attendanceTrend,
      assessmentBalance,
      talentParticipation,
      wellbeingIndicators,
      pathwayReadiness,
      competencyGaps,
      interventions,
    };
  });
}
