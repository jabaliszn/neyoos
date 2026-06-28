import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import type { SessionUser } from "../src/lib/core/session";
import {
  getLearnerJourneyTimeline,
  LearnerJourneyError,
} from "../src/lib/services/learner-journey.service";

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof db.user.findFirst>>>): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    neyoLoginId: user.neyoLoginId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role as SessionUser["role"],
    secondaryRole: (user.secondaryRole as SessionUser["secondaryRole"]) ?? null,
    language: user.language ?? "en",
  };
}

async function main() {
  console.log("Starting J.8 Learning Journey Timeline service test...");

  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principal = toSessionUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }));
  const parent = toSessionUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "parent@karibuhigh.ac.ke" } }));
  const accountant = toSessionUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "accounts@karibuhigh.ac.ke" } }));

  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Achieng" } });
  const subject = await db.subject.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const currentTerm = await db.academicTerm.findFirstOrThrow({ where: { tenantId: tenant.id } });

  const tag = `J8TEST-${Date.now()}`;
  const attendanceDate = "2031-01-15";
  const attendanceDate2 = "2031-01-16";
  const counselingSecret = `${tag} counseling content should never appear in the learner journey`;

  const cleanup = {
    examIds: [] as string[],
    assessmentTypeIds: [] as string[],
    assessmentPlanIds: [] as string[],
    assessmentRecordIds: [] as string[],
    competencyGroupIds: [] as string[],
    competencyIds: [] as string[],
    competencyEvidenceIds: [] as string[],
    skillIds: [] as string[],
    portfolioIds: [] as string[],
    incidentIds: [] as string[],
    suspensionIds: [] as string[],
    counselingIds: [] as string[],
  };

  await withTenant(tenant.id, async () => {
    // Clean previous crashes for the same deterministic dates.
    await tenantDb().attendanceRecord.deleteMany({ where: { studentId: student.id, date: { in: [attendanceDate, attendanceDate2] } } });

    // 0. Access guards.
    await getLearnerJourneyTimeline(accountant, { studentId: student.id, mode: "staff" })
      .then(() => { throw new Error("Accountant should be forbidden from learner journey access."); })
      .catch((error) => {
        if (error instanceof LearnerJourneyError && error.code === "FORBIDDEN") {
          console.log("✓ accountant correctly blocked from learner journey access");
          return;
        }
        throw error;
      });

    await getLearnerJourneyTimeline(parent, { studentId: student.id, mode: "staff" })
      .then(() => { throw new Error("Parent should not access staff learner journey mode."); })
      .catch((error) => {
        if (error instanceof LearnerJourneyError && error.code === "FORBIDDEN") {
          console.log("✓ parent correctly blocked from staff learner journey mode");
          return;
        }
        throw error;
      });

    // 1. Create deterministic exam entries: one published, one internal.
    const publishedExam = await tenantDb().exam.create({
      data: {
        name: `${tag} Published Exam`,
        year: 2031,
        term: 1,
        type: "CAT",
        maxMarks: 100,
        published: true,
        subjects: { create: [{ subjectId: subject.id }] },
      } as never,
    });
    cleanup.examIds.push(publishedExam.id);

    const internalExam = await tenantDb().exam.create({
      data: {
        name: `${tag} Internal Exam`,
        year: 2031,
        term: 1,
        type: "EXAM",
        maxMarks: 100,
        published: false,
        subjects: { create: [{ subjectId: subject.id }] },
      } as never,
    });
    cleanup.examIds.push(internalExam.id);

    await tenantDb().examResult.create({
      data: {
        tenantId: tenant.id,
        examId: publishedExam.id,
        studentId: student.id,
        subjectId: subject.id,
        marks: 84,
        enteredById: principal.id,
      } as never,
    });
    await tenantDb().examResult.create({
      data: {
        tenantId: tenant.id,
        examId: internalExam.id,
        studentId: student.id,
        subjectId: subject.id,
        marks: 61,
        enteredById: principal.id,
      } as never,
    });

    // 2. Flexible assessments: one released/parent-visible, one internal.
    const releasedType = await tenantDb().assessmentType.create({
      data: {
        tenantId: tenant.id,
        key: `${tag}_RELEASED_TYPE`,
        name: `${tag} Project`,
        category: "PRACTICAL",
        scoreMode: "MIXED",
        defaultMaxMarks: 100,
        defaultWeight: 10,
        evidenceAllowed: true,
        requiresModeration: true,
        active: true,
      } as never,
    });
    cleanup.assessmentTypeIds.push(releasedType.id);

    const hiddenType = await tenantDb().assessmentType.create({
      data: {
        tenantId: tenant.id,
        key: `${tag}_HIDDEN_TYPE`,
        name: `${tag} Oral`,
        category: "OBSERVATION",
        scoreMode: "NARRATIVE",
        defaultWeight: 0,
        evidenceAllowed: true,
        requiresModeration: false,
        active: true,
      } as never,
    });
    cleanup.assessmentTypeIds.push(hiddenType.id);

    const releasedPlan = await tenantDb().assessmentPlan.create({
      data: {
        tenantId: tenant.id,
        assessmentTypeId: releasedType.id,
        classId: student.classId,
        subjectId: subject.id,
        academicTermId: currentTerm.id,
        year: 2031,
        term: 1,
        title: `${tag} Released Family Project`,
        weight: 10,
        maxMarks: 100,
        status: "RELEASED",
        visibleToParents: true,
        createdById: principal.id,
        createdByName: principal.fullName,
      } as never,
    });
    cleanup.assessmentPlanIds.push(releasedPlan.id);

    const hiddenPlan = await tenantDb().assessmentPlan.create({
      data: {
        tenantId: tenant.id,
        assessmentTypeId: hiddenType.id,
        classId: student.classId,
        subjectId: subject.id,
        academicTermId: currentTerm.id,
        year: 2031,
        term: 1,
        title: `${tag} Staff Only Oral`,
        weight: 0,
        status: "ACTIVE",
        visibleToParents: false,
        createdById: principal.id,
        createdByName: principal.fullName,
      } as never,
    });
    cleanup.assessmentPlanIds.push(hiddenPlan.id);

    const releasedRecord = await tenantDb().assessmentRecord.create({
      data: {
        tenantId: tenant.id,
        planId: releasedPlan.id,
        studentId: student.id,
        scoreMarks: 92,
        scorePct: 92,
        narrative: `${tag} learner explained the project clearly`,
        status: "RELEASED",
        assessedById: principal.id,
        assessedByName: principal.fullName,
        assessedAt: new Date("2031-01-12T09:00:00.000Z"),
        releasedAt: new Date("2031-01-13T09:00:00.000Z"),
      } as never,
    });
    cleanup.assessmentRecordIds.push(releasedRecord.id);

    const hiddenRecord = await tenantDb().assessmentRecord.create({
      data: {
        tenantId: tenant.id,
        planId: hiddenPlan.id,
        studentId: student.id,
        scoreMarks: 55,
        scorePct: 55,
        narrative: `${tag} internal oral draft`,
        status: "SCORED",
        assessedById: principal.id,
        assessedByName: principal.fullName,
        assessedAt: new Date("2031-01-14T09:00:00.000Z"),
      } as never,
    });
    cleanup.assessmentRecordIds.push(hiddenRecord.id);

    // 3. Attendance: one absence and one late mark.
    await tenantDb().attendanceRecord.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        classId: student.classId,
        date: attendanceDate,
        status: "A",
        note: `${tag} absent for medical review`,
        markedById: principal.id,
        markedByName: principal.fullName,
      } as never,
    });
    await tenantDb().attendanceRecord.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        classId: student.classId,
        date: attendanceDate2,
        status: "L",
        note: `${tag} late because of heavy rain`,
        markedById: principal.id,
        markedByName: principal.fullName,
      } as never,
    });

    // 4. Discipline: one parent-safe approved case, one staff-only pending case, one suspension.
    const approvedIncident = await tenantDb().disciplineIncident.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        studentName: "Achieng Mary Otieno",
        admissionNo: student.admissionNo,
        date: "2031-01-10",
        category: "BULLYING",
        severity: "MAJOR",
        points: 3,
        description: `${tag} approved discipline case`,
        actionTaken: "Met the deputy principal",
        reportedById: principal.id,
        reportedByName: principal.fullName,
        status: "APPROVED",
        approvedById: principal.id,
        approvedByName: principal.fullName,
        approvedAt: new Date("2031-01-10T11:00:00.000Z"),
        parentNotifiedAt: new Date("2031-01-10T11:10:00.000Z"),
      } as never,
    });
    cleanup.incidentIds.push(approvedIncident.id);

    const pendingIncident = await tenantDb().disciplineIncident.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        studentName: "Achieng Mary Otieno",
        admissionNo: student.admissionNo,
        date: "2031-01-11",
        category: "NOISEMAKING",
        severity: "MINOR",
        points: 1,
        description: `${tag} pending internal discipline case`,
        actionTaken: "Awaiting review",
        reportedById: principal.id,
        reportedByName: principal.fullName,
        status: "PENDING",
      } as never,
    });
    cleanup.incidentIds.push(pendingIncident.id);

    const suspension = await tenantDb().suspension.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        studentName: "Achieng Mary Otieno",
        admissionNo: student.admissionNo,
        startDate: "2031-01-18",
        endDate: "2031-01-20",
        reason: `${tag} suspension reason`,
        conditions: "Return with parent",
        status: "ACTIVE",
        issuedById: principal.id,
        issuedByName: principal.fullName,
        approvedById: principal.id,
        approvedByName: principal.fullName,
        approvedAt: new Date("2031-01-18T08:00:00.000Z"),
        parentNotifiedAt: new Date("2031-01-18T08:05:00.000Z"),
      } as never,
    });
    cleanup.suspensionIds.push(suspension.id);

    // Counseling note should NEVER leak into learner journey output.
    const counseling = await tenantDb().counselingNote.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        studentName: "Achieng Mary Otieno",
        date: "2031-01-12",
        sessionType: "INDIVIDUAL",
        note: counselingSecret,
        counselorId: principal.id,
        counselorName: principal.fullName,
      } as never,
    });
    cleanup.counselingIds.push(counseling.id);

    // 5. Competency evidence: one approved/visible, one hidden.
    const group = await tenantDb().competencyGroup.create({
      data: {
        tenantId: tenant.id,
        name: `${tag} Core Group`,
        code: `${tag}_GROUP`,
      } as never,
    });
    cleanup.competencyGroupIds.push(group.id);

    const visibleCompetency = await tenantDb().competency.create({
      data: {
        tenantId: tenant.id,
        groupId: group.id,
        name: `${tag} Visible Communication`,
        code: `${tag}_VISIBLE_COMP`,
      } as never,
    });
    cleanup.competencyIds.push(visibleCompetency.id);

    const hiddenCompetency = await tenantDb().competency.create({
      data: {
        tenantId: tenant.id,
        groupId: group.id,
        name: `${tag} Hidden Problem Solving`,
        code: `${tag}_HIDDEN_COMP`,
      } as never,
    });
    cleanup.competencyIds.push(hiddenCompetency.id);

    const visibleEvidence = await tenantDb().competencyEvidence.create({
      data: {
        tenantId: tenant.id,
        competencyId: visibleCompetency.id,
        studentId: student.id,
        sourceModule: "ASSESSMENT",
        level: 4,
        scorePct: 91,
        narrative: `${tag} communicates confidently in presentations`,
        evidenceDate: "2031-01-09",
        recordedById: principal.id,
        recordedByName: principal.fullName,
        approved: true,
        visibleToParents: true,
      } as never,
    });
    cleanup.competencyEvidenceIds.push(visibleEvidence.id);

    const hiddenEvidence = await tenantDb().competencyEvidence.create({
      data: {
        tenantId: tenant.id,
        competencyId: hiddenCompetency.id,
        studentId: student.id,
        sourceModule: "MANUAL",
        level: 2,
        narrative: `${tag} still needs internal coaching`,
        evidenceDate: "2031-01-08",
        recordedById: principal.id,
        recordedByName: principal.fullName,
        approved: false,
        visibleToParents: false,
      } as never,
    });
    cleanup.competencyEvidenceIds.push(hiddenEvidence.id);

    // 6. Skills passport entry.
    const skill = await tenantDb().skillsPassportEntry.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        skillArea: `${tag} Coding`,
        ratingLevel: 5,
        evidenceSource: "AWARD",
        sourceId: tag,
        narrative: `${tag} won the inter-school coding challenge`,
        evidenceDate: "2031-01-07",
        recordedById: principal.id,
        recordedByName: principal.fullName,
        verified: true,
      } as never,
    });
    cleanup.skillIds.push(skill.id);

    // 7. Portfolio + certificate: one visible portfolio item, one hidden draft, one visible certificate.
    const visiblePortfolio = await tenantDb().portfolioItem.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        title: `${tag} Community Reflection`,
        category: "COMMUNITY",
        description: `${tag} planted trees with the environment club`,
        status: "APPROVED",
        visibleToParents: true,
        approvedById: principal.id,
        approvedByName: principal.fullName,
        approvedAt: new Date("2031-01-06T09:00:00.000Z"),
        createdById: principal.id,
        createdByName: principal.fullName,
      } as never,
    });
    cleanup.portfolioIds.push(visiblePortfolio.id);

    const hiddenPortfolio = await tenantDb().portfolioItem.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        title: `${tag} Hidden Draft Portfolio`,
        category: "PROJECT",
        description: `${tag} still waiting for school review`,
        status: "SUBMITTED",
        visibleToParents: false,
        createdById: principal.id,
        createdByName: principal.fullName,
      } as never,
    });
    cleanup.portfolioIds.push(hiddenPortfolio.id);

    const certificatePortfolio = await tenantDb().portfolioItem.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        title: `${tag} Music Festival Certificate`,
        category: "CERTIFICATE",
        description: `${tag} received a county music certificate`,
        status: "APPROVED",
        visibleToParents: true,
        approvedById: principal.id,
        approvedByName: principal.fullName,
        approvedAt: new Date("2031-01-05T09:00:00.000Z"),
        createdById: principal.id,
        createdByName: principal.fullName,
      } as never,
    });
    cleanup.portfolioIds.push(certificatePortfolio.id);

    // 8. Staff timeline should aggregate the real sources.
    const staffTimeline = await getLearnerJourneyTimeline(principal, { studentId: student.id, mode: "staff", limit: 200 });
    const staffTitles = staffTimeline.entries.map((entry) => entry.title);
    const staffSourceSet = new Set(staffTimeline.entries.map((entry) => entry.sourceModule));

    if (!staffSourceSet.has("EXAM") || !staffSourceSet.has("ASSESSMENT") || !staffSourceSet.has("ATTENDANCE") || !staffSourceSet.has("DISCIPLINE") || !staffSourceSet.has("COMPETENCY") || !staffSourceSet.has("SKILLS") || !staffSourceSet.has("PORTFOLIO") || !staffSourceSet.has("CERTIFICATE")) {
      throw new Error(`Staff learner journey should aggregate the core source modules. Found: ${[...staffSourceSet].join(", ")}`);
    }
    if (!staffTitles.includes(`${tag} Published Exam`) || !staffTitles.includes(`${tag} Internal Exam`)) {
      throw new Error("Staff learner journey should include both published and internal exam events.");
    }
    if (!staffTitles.includes(`${tag} Released Family Project · ${tag} Project`)) {
      throw new Error("Staff learner journey should include released flexible assessments.");
    }
    if (!staffTitles.includes(`${tag} Staff Only Oral · ${tag} Oral`)) {
      throw new Error("Staff learner journey should include internal flexible assessments.");
    }
    if (!staffTitles.includes(`${tag} Visible Communication competency evidence`) || !staffTitles.includes(`${tag} Hidden Problem Solving competency evidence`)) {
      throw new Error("Staff learner journey should include both visible and internal competency evidence.");
    }
    console.log("✓ staff learner journey aggregates exams, assessments, attendance, discipline, competencies, skills, portfolio and certificates");

    // 9. Parent timeline should be strictly parent-safe.
    const parentTimeline = await getLearnerJourneyTimeline(parent, { studentId: student.id, mode: "parent", limit: 200 });
    const parentTitles = parentTimeline.entries.map((entry) => entry.title);
    const parentText = parentTimeline.entries.map((entry) => `${entry.title} ${entry.summary}`).join(" || ");

    if (parentTimeline.entries.some((entry) => entry.visibility !== "PARENT_SAFE")) {
      throw new Error("Parent learner journey should only contain parent-safe entries.");
    }
    if (!parentTitles.includes(`${tag} Published Exam`) || parentTitles.includes(`${tag} Internal Exam`)) {
      throw new Error("Parent learner journey should include only published exam milestones.");
    }
    if (!parentTitles.includes(`${tag} Released Family Project · ${tag} Project`) || parentTitles.includes(`${tag} Staff Only Oral · ${tag} Oral`)) {
      throw new Error("Parent learner journey should filter assessments by release + visibleToParents.");
    }
    if (!parentTitles.includes(`${tag} Visible Communication competency evidence`) || parentTitles.includes(`${tag} Hidden Problem Solving competency evidence`)) {
      throw new Error("Parent learner journey should filter competencies by approval + visibleToParents.");
    }
    if (!parentTitles.includes(`${tag} Community Reflection`) || parentTitles.includes(`${tag} Hidden Draft Portfolio`)) {
      throw new Error("Parent learner journey should include only approved visible portfolio items.");
    }
    if (!parentTitles.includes(`${tag} Music Festival Certificate`)) {
      throw new Error("Parent learner journey should include visible certificate milestones.");
    }
    if (parentText.includes(counselingSecret)) {
      throw new Error("Confidential counseling content leaked into the parent learner journey.");
    }
    console.log("✓ parent learner journey is strictly parent-safe and excludes confidential/internal items");

    // 10. Source filter: certificate should only return certificate entries.
    const certificateOnly = await getLearnerJourneyTimeline(principal, {
      studentId: student.id,
      mode: "staff",
      source: "CERTIFICATE",
      limit: 20,
    });
    if (!certificateOnly.entries.length || certificateOnly.entries.some((entry) => entry.sourceModule !== "CERTIFICATE")) {
      throw new Error("Certificate filter should return only CERTIFICATE source entries.");
    }
    if (!certificateOnly.entries.some((entry) => entry.title === `${tag} Music Festival Certificate`)) {
      throw new Error("Certificate filter should include the certificate portfolio milestone.");
    }
    console.log("✓ certificate source filter isolates learner certificate milestones correctly");

    // 11. Date filter + limit.
    const attendanceOnly = await getLearnerJourneyTimeline(principal, {
      studentId: student.id,
      mode: "staff",
      source: "ATTENDANCE",
      from: attendanceDate,
      to: attendanceDate,
      limit: 20,
    });
    if (attendanceOnly.entries.length !== 1 || attendanceOnly.entries[0].date !== attendanceDate) {
      throw new Error("Attendance date filter should isolate the selected Nairobi day.");
    }
    console.log("✓ date filter isolates learner timeline entries correctly");

    const limited = await getLearnerJourneyTimeline(principal, { studentId: student.id, mode: "staff", limit: 3 });
    if (limited.entries.length !== 3 || limited.summary.returnedEntries !== 3) {
      throw new Error("Timeline limit should cap the returned entries.");
    }
    console.log("✓ timeline limit caps returned entries cleanly");
  });

  // Cleanup test records in dependency-safe order.
  await withTenant(tenant.id, async () => {
    if (cleanup.counselingIds.length) await tenantDb().counselingNote.deleteMany({ where: { id: { in: cleanup.counselingIds } } });
    if (cleanup.suspensionIds.length) await tenantDb().suspension.deleteMany({ where: { id: { in: cleanup.suspensionIds } } });
    if (cleanup.incidentIds.length) await tenantDb().disciplineIncident.deleteMany({ where: { id: { in: cleanup.incidentIds } } });
    if (cleanup.portfolioIds.length) await tenantDb().portfolioItem.deleteMany({ where: { id: { in: cleanup.portfolioIds } } });
    if (cleanup.skillIds.length) await tenantDb().skillsPassportEntry.deleteMany({ where: { id: { in: cleanup.skillIds } } });
    if (cleanup.competencyEvidenceIds.length) await tenantDb().competencyEvidence.deleteMany({ where: { id: { in: cleanup.competencyEvidenceIds } } });
    if (cleanup.competencyIds.length) await tenantDb().competency.deleteMany({ where: { id: { in: cleanup.competencyIds } } });
    if (cleanup.competencyGroupIds.length) await tenantDb().competencyGroup.deleteMany({ where: { id: { in: cleanup.competencyGroupIds } } });
    if (cleanup.assessmentRecordIds.length) await tenantDb().assessmentRecord.deleteMany({ where: { id: { in: cleanup.assessmentRecordIds } } });
    if (cleanup.assessmentPlanIds.length) await tenantDb().assessmentPlan.deleteMany({ where: { id: { in: cleanup.assessmentPlanIds } } });
    if (cleanup.assessmentTypeIds.length) await tenantDb().assessmentType.deleteMany({ where: { id: { in: cleanup.assessmentTypeIds } } });
    if (cleanup.examIds.length) {
      await tenantDb().examResult.deleteMany({ where: { examId: { in: cleanup.examIds } } });
      await tenantDb().exam.deleteMany({ where: { id: { in: cleanup.examIds } } });
    }
    await tenantDb().attendanceRecord.deleteMany({ where: { studentId: student.id, date: { in: [attendanceDate, attendanceDate2] } } });
  });

  console.log("✓ cleaned up J.8 service test data");
  console.log("J.8 Chunk 3 Learning Journey Timeline service test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
