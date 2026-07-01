/**
 * PART J.8 — Learning Journey Timeline backend aggregation service.
 *
 * This service builds a unified learner journey timeline by reading existing
 * source modules instead of creating a duplicate learner-history table.
 *
 * Source modules reused here:
 * - B.5 Exams (`ExamResult`)
 * - J.3 Flexible Assessments (`AssessmentRecord`)
 * - B.3 Attendance (`AttendanceRecord`)
 * - B.20 Discipline (`DisciplineIncident`, `Suspension`)
 * - J.4 Competency Evidence (`CompetencyEvidence`)
 * - J.6 Skills Passport (`SkillsPassportEntry`)
 * - J.7 Portfolio (`PortfolioItem`)
 * - B.1 Transfer history (`StudentTransfer`) as a SYSTEM milestone
 * - J.17 Community Service (`CommunityServiceActivity`)
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { scopeWhere } from "@/lib/services/student.service";
import { issueVerification } from "@/lib/services/document.service";
import {
  learnerJourneyEntrySchema,
  learnerJourneyPinSchema,
  learnerJourneyQuerySchema,
  learnerJourneyUnpinSchema,
  userCanPinLearnerJourney,
  userCanReadLearnerJourney,
  userCanAccessLearnerJourneyMode,
  LEARNER_JOURNEY_SOURCES,
  type LearnerJourneyPinInput,
  type LearnerJourneyQueryInput,
  type LearnerJourneyUnpinInput,
} from "@/lib/validations/learner-journey";

export class LearnerJourneyError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "INVALID", message: string) {
    super(message);
    this.name = "LearnerJourneyError";
  }
}

function assertRead(user: SessionUser) {
  if (!userCanReadLearnerJourney(user)) {
    throw new LearnerJourneyError("FORBIDDEN", "You do not have permission to view learner journeys.");
  }
}

function assertMode(user: SessionUser, mode: "staff" | "parent") {
  if (!userCanAccessLearnerJourneyMode(user, mode)) {
    throw new LearnerJourneyError("FORBIDDEN", "You do not have permission to view that learner journey mode.");
  }
}

function assertPin(user: SessionUser) {
  if (!userCanPinLearnerJourney(user)) {
    throw new LearnerJourneyError("FORBIDDEN", "You do not have permission to pin learner milestones.");
  }
}

function ymdFromDate(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function isWithinRange(date: string, from?: string, to?: string) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function compactSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string | null | undefined, max = 180) {
  if (!value) return undefined;
  const cleaned = compactSpaces(value);
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function titleCase(value: string | null | undefined) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function skillEvidenceLabel(value: string) {
  return titleCase(value).toLowerCase();
}

function portfolioCategoryLabel(value: string) {
  switch (value) {
    case "PROJECT": return "project";
    case "VIDEO": return "video showcase";
    case "PHOTO": return "photo evidence";
    case "ART": return "art showcase";
    case "CODING": return "coding work";
    case "CERTIFICATE": return "certificate";
    case "OBSERVATION": return "teacher observation";
    case "COMMUNITY": return "community reflection";
    default: return titleCase(value).toLowerCase();
  }
}

function attendanceTitle(status: string) {
  switch (status) {
    case "A": return "Absent from school";
    case "L": return "Late arrival recorded";
    case "E": return "Excused attendance recorded";
    default: return "Attendance recorded";
  }
}

function attendanceSummary(status: string, note?: string | null) {
  const base =
    status === "A" ? "The learner was marked absent."
      : status === "L" ? "The learner was marked late."
      : status === "E" ? "The learner was marked excused."
      : "Attendance was recorded.";
  const notePart = truncate(note, 120);
  return notePart ? `${base} Note: ${notePart}` : base;
}

function buildScoreSnippet(scorePct?: number | null, scoreMarks?: number | null, maxMarks?: number | null) {
  if (typeof scorePct === "number") return `Scored ${scorePct}%.`;
  if (typeof scoreMarks === "number" && typeof maxMarks === "number" && maxMarks > 0) {
    return `Scored ${scoreMarks}/${maxMarks}.`;
  }
  if (typeof scoreMarks === "number") return `Scored ${scoreMarks} marks.`;
  return undefined;
}

function buildEntrySummary(parts: Array<string | undefined>) {
  return compactSpaces(parts.filter(Boolean).join(" "));
}

function sortEntries(a: ReturnType<typeof learnerJourneyEntrySchema.parse>, b: ReturnType<typeof learnerJourneyEntrySchema.parse>) {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  const sourceCmp = a.sourceModule.localeCompare(b.sourceModule);
  if (sourceCmp !== 0) return sourceCmp;
  return a.title.localeCompare(b.title);
}

async function collectExamEntries(
  studentId: string,
  mode: "staff" | "parent",
  push: (entry: Parameters<typeof learnerJourneyEntrySchema.parse>[0]) => void,
) {
  const rows = await tenantDb().examResult.findMany({
    where: {
      studentId,
      ...(mode === "parent" ? { exam: { published: true } } : {}),
    },
    include: { exam: true },
  });

  const grouped = new Map<string, {
    examId: string;
    name: string;
    published: boolean;
    maxMarks: number;
    year: number;
    term: number;
    type: string;
    totalMarks: number;
    subjectCount: number;
    latestUpdatedAt: Date;
  }>();

  for (const row of rows) {
    const current = grouped.get(row.examId) ?? {
      examId: row.examId,
      name: row.exam.name,
      published: row.exam.published,
      maxMarks: row.exam.maxMarks,
      year: row.exam.year,
      term: row.exam.term,
      type: row.exam.type,
      totalMarks: 0,
      subjectCount: 0,
      latestUpdatedAt: row.updatedAt,
    };
    current.totalMarks += row.marks;
    current.subjectCount += 1;
    if (row.updatedAt > current.latestUpdatedAt) current.latestUpdatedAt = row.updatedAt;
    grouped.set(row.examId, current);
  }

  for (const exam of grouped.values()) {
    const avgPct = exam.subjectCount > 0
      ? Math.round((exam.totalMarks / (exam.subjectCount * Math.max(1, exam.maxMarks))) * 100)
      : 0;
    const visibility = exam.published ? "PARENT_SAFE" : "STAFF";
    push({
      id: `exam:${exam.examId}`,
      date: ymdFromDate(exam.latestUpdatedAt) ?? ymdFromDate(new Date())!,
      sourceModule: "EXAM",
      eventType: "EXAM_RESULT_RECORDED",
      title: exam.name,
      summary: buildEntrySummary([
        `Average ${avgPct}% across ${exam.subjectCount} subject${exam.subjectCount === 1 ? "" : "s"}.`,
        exam.published ? "Results released to families." : "Results kept inside school review.",
      ]),
      status: exam.published ? "PUBLISHED" : "INTERNAL",
      href: exam.published ? `/api/exams/${exam.examId}/report/${studentId}` : "/exams",
      visibility,
      verificationStatus: "VERIFIED",
    });
  }
}

async function collectAssessmentEntries(
  studentId: string,
  mode: "staff" | "parent",
  push: (entry: Parameters<typeof learnerJourneyEntrySchema.parse>[0]) => void,
) {
  const rows = await tenantDb().assessmentRecord.findMany({
    where: {
      studentId,
      ...(mode === "parent"
        ? {
            status: "RELEASED",
            plan: { visibleToParents: true },
          }
        : {}),
    },
    include: {
      plan: { include: { assessmentType: true } },
    },
    orderBy: { assessedAt: "desc" },
  });

  for (const row of rows) {
    const visibility = row.plan.visibleToParents && row.status === "RELEASED" ? "PARENT_SAFE" : "STAFF";
    push({
      id: `assessment:${row.id}`,
      date: ymdFromDate(row.releasedAt ?? row.moderatedAt ?? row.assessedAt) ?? ymdFromDate(new Date())!,
      sourceModule: "ASSESSMENT",
      eventType: "ASSESSMENT_RECORDED",
      title: `${row.plan.title} · ${row.plan.assessmentType.name}`,
      summary: buildEntrySummary([
        buildScoreSnippet(row.scorePct, row.scoreMarks, row.plan.maxMarks),
        row.rubricCode ? `Rubric ${row.rubricCode}.` : undefined,
        truncate(row.narrative),
        row.status === "RELEASED" ? "Released to families." : "Internal assessment workflow still in progress.",
      ]),
      status: row.status,
      href: "/assessments",
      visibility,
      verificationStatus: row.status === "RELEASED" || row.status === "MODERATED" ? "VERIFIED" : "PENDING",
    });
  }
}

async function collectAttendanceEntries(
  studentId: string,
  push: (entry: Parameters<typeof learnerJourneyEntrySchema.parse>[0]) => void,
) {
  const rows = await tenantDb().attendanceRecord.findMany({
    where: {
      studentId,
      status: { in: ["A", "L", "E"] },
    },
    orderBy: { date: "desc" },
    take: 120,
  });

  for (const row of rows) {
    push({
      id: `attendance:${row.id}`,
      date: row.date,
      sourceModule: "ATTENDANCE",
      eventType: `ATTENDANCE_${row.status}`,
      title: attendanceTitle(row.status),
      summary: attendanceSummary(row.status, row.note),
      status: row.status,
      href: "/attendance",
      visibility: "PARENT_SAFE",
      verificationStatus: "NOT_REQUIRED",
    });
  }
}

async function collectDisciplineEntries(
  studentId: string,
  mode: "staff" | "parent",
  push: (entry: Parameters<typeof learnerJourneyEntrySchema.parse>[0]) => void,
) {
  const [incidents, suspensions] = await Promise.all([
    tenantDb().disciplineIncident.findMany({
      where: {
        studentId,
        status: { in: mode === "parent" ? ["APPROVED"] : ["PENDING", "APPROVED"] },
        ...(mode === "parent" ? { parentNotifiedAt: { not: null } } : {}),
      },
      orderBy: { date: "desc" },
      take: 60,
    }),
    tenantDb().suspension.findMany({
      where: {
        studentId,
        ...(mode === "parent" ? { parentNotifiedAt: { not: null } } : {}),
      },
      orderBy: { startDate: "desc" },
      take: 30,
    }),
  ]);

  for (const row of incidents) {
    const parentSafe = Boolean(row.parentNotifiedAt);
    push({
      id: `discipline-incident:${row.id}`,
      date: row.date,
      sourceModule: "DISCIPLINE",
      eventType: row.status === "PENDING" ? "DISCIPLINE_PENDING" : "DISCIPLINE_APPROVED",
      title: `${titleCase(row.severity)} discipline incident`,
      summary: buildEntrySummary([
        `${titleCase(row.category)} incident recorded.`,
        row.actionTaken ? `Action: ${truncate(row.actionTaken, 100)}.` : undefined,
        row.status === "PENDING" ? "Awaiting leadership approval." : undefined,
      ]),
      status: row.status,
      href: "/discipline",
      visibility: parentSafe ? "PARENT_SAFE" : "STAFF",
      verificationStatus: row.status === "APPROVED" ? "VERIFIED" : "PENDING",
    });
  }

  for (const row of suspensions) {
    const parentSafe = Boolean(row.parentNotifiedAt);
    push({
      id: `discipline-suspension:${row.id}`,
      date: row.startDate,
      sourceModule: "DISCIPLINE",
      eventType: "SUSPENSION_RECORDED",
      title: "Suspension recorded",
      summary: buildEntrySummary([
        `From ${row.startDate} to ${row.endDate}.`,
        truncate(row.reason, 120),
        row.conditions ? `Return conditions: ${truncate(row.conditions, 100)}.` : undefined,
      ]),
      status: row.status,
      href: "/discipline",
      visibility: parentSafe ? "PARENT_SAFE" : "STAFF",
      verificationStatus: row.status === "PENDING" ? "PENDING" : "VERIFIED",
    });
  }
}

async function collectCompetencyEntries(
  studentId: string,
  mode: "staff" | "parent",
  push: (entry: Parameters<typeof learnerJourneyEntrySchema.parse>[0]) => void,
) {
  const rows = await tenantDb().competencyEvidence.findMany({
    where: {
      studentId,
      ...(mode === "parent" ? { approved: true, visibleToParents: true } : {}),
    },
    include: { competency: { include: { group: true } } },
    orderBy: { evidenceDate: "desc" },
    take: 100,
  });

  for (const row of rows) {
    const visibility = row.approved && row.visibleToParents ? "PARENT_SAFE" : "STAFF";
    const scorePart = typeof row.scorePct === "number" ? `${row.scorePct}%.` : undefined;
    const levelPart = typeof row.level === "number" ? `Level ${row.level}.` : undefined;
    push({
      id: `competency:${row.id}`,
      date: row.evidenceDate,
      sourceModule: "COMPETENCY",
      eventType: "COMPETENCY_EVIDENCE_RECORDED",
      title: `${row.competency.name} competency evidence`,
      summary: buildEntrySummary([
        row.competency.group?.name ? `${row.competency.group.name}.` : undefined,
        levelPart,
        scorePart,
        truncate(row.narrative),
      ]),
      status: row.approved ? "APPROVED" : "PENDING",
      href: "/competencies",
      visibility,
      verificationStatus: row.approved ? "VERIFIED" : "PENDING",
    });
  }
}

async function collectSkillsEntries(
  studentId: string,
  push: (entry: Parameters<typeof learnerJourneyEntrySchema.parse>[0]) => void,
) {
  const rows = await tenantDb().skillsPassportEntry.findMany({
    where: { studentId },
    orderBy: { evidenceDate: "desc" },
    take: 100,
  });

  for (const row of rows) {
    push({
      id: `skills:${row.id}`,
      date: row.evidenceDate,
      sourceModule: "SKILLS",
      eventType: "SKILL_RATING_RECORDED",
      title: `${row.skillArea} skill update`,
      summary: buildEntrySummary([
        `Rated ${row.ratingLevel}/5 from ${skillEvidenceLabel(row.evidenceSource)} evidence.`,
        truncate(row.narrative),
      ]),
      status: row.verified ? "VERIFIED" : "PENDING",
      visibility: "PARENT_SAFE",
      verificationStatus: row.verified ? "VERIFIED" : "PENDING",
    });
  }
}

async function collectPortfolioEntries(
  studentId: string,
  mode: "staff" | "parent",
  source: "PORTFOLIO" | "CERTIFICATE" | undefined,
  push: (entry: Parameters<typeof learnerJourneyEntrySchema.parse>[0]) => void,
) {
  const where: Record<string, unknown> = { studentId };
  if (mode === "parent") {
    Object.assign(where, { status: "APPROVED", visibleToParents: true });
  }
  if (source === "PORTFOLIO") {
    Object.assign(where, { category: { not: "CERTIFICATE" } });
  }
  if (source === "CERTIFICATE") {
    Object.assign(where, { category: "CERTIFICATE" });
  }

  const rows = await tenantDb().portfolioItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  for (const row of rows) {
    const sourceModule = row.category === "CERTIFICATE" ? "CERTIFICATE" : "PORTFOLIO";
    const visibility = row.status === "APPROVED" && row.visibleToParents ? "PARENT_SAFE" : "STAFF";
    push({
      id: `portfolio:${row.id}`,
      date: ymdFromDate(row.approvedAt ?? row.updatedAt ?? row.createdAt) ?? ymdFromDate(new Date())!,
      sourceModule,
      eventType: `${sourceModule}_${row.status}`,
      title: row.title,
      summary: buildEntrySummary([
        `${titleCase(portfolioCategoryLabel(row.category))} added to the learner journey.`,
        truncate(row.description),
        row.externalLink ? "External link attached." : undefined,
      ]),
      status: row.status,
      href: `/portfolio?studentId=${studentId}`,
      visibility,
      verificationStatus: row.status === "APPROVED" ? "VERIFIED" : "PENDING",
    });
  }
}


async function collectCommunityServiceEntries(
  studentId: string,
  mode: "staff" | "parent",
  push: (entry: Parameters<typeof learnerJourneyEntrySchema.parse>[0]) => void,
) {
  const rows = await tenantDb().communityServiceActivity.findMany({
    where: {
      studentId,
      ...(mode === "parent" ? { status: "APPROVED" } : {}),
    },
    orderBy: { date: "desc" },
    take: 60,
  });

  for (const row of rows) {
    push({
      id: `community:${row.id}`,
      date: row.date,
      sourceModule: "PORTFOLIO",
      eventType: `COMMUNITY_${row.status}`,
      title: row.title,
      summary: buildEntrySummary([
        `Community service in ${titleCase(row.category)} for ${row.hours} hour${row.hours === 1 ? "" : "s"}.`,
        row.location ? `Location: ${truncate(row.location, 80)}.` : undefined,
        row.supervisorName ? `Supervisor: ${truncate(row.supervisorName, 80)}.` : undefined,
        truncate(row.studentReflection),
      ]),
      status: row.status,
      href: `/students/${studentId}`,
      visibility: row.status === "APPROVED" ? "PARENT_SAFE" : "STAFF",
      verificationStatus: row.status === "APPROVED" ? "VERIFIED" : "PENDING",
    });
  }
}

async function collectSystemEntries(
  studentId: string,
  push: (entry: Parameters<typeof learnerJourneyEntrySchema.parse>[0]) => void,
) {
  const rows = await tenantDb().studentTransfer.findMany({
    where: { studentId },
    orderBy: { transferDate: "desc" },
    take: 20,
  });

  for (const row of rows) {
    push({
      id: `system-transfer:${row.id}`,
      date: row.transferDate,
      sourceModule: "SYSTEM",
      eventType: "TRANSFER_RECORDED",
      title: "Transfer recorded",
      summary: buildEntrySummary([
        `Transfer destination: ${truncate(row.destinationSchool, 120)}.`,
        row.destinationCounty ? `County: ${truncate(row.destinationCounty, 60)}.` : undefined,
        row.reason ? `Reason: ${truncate(row.reason, 120)}.` : undefined,
        row.reversedAt ? "This transfer was later reversed." : undefined,
      ]),
      status: row.reversedAt ? "REVERSED" : "ACTIVE",
      href: `/students/${studentId}`,
      visibility: "PARENT_SAFE",
      verificationStatus: "VERIFIED",
    });
  }
}

async function assertScopedStudent(user: SessionUser, studentId: string) {
  const scope = await scopeWhere(user);
  const student = await tenantDb().student.findFirst({
    where: { AND: [{ id: studentId }, scope] },
    include: { schoolClass: true },
  });
  if (!student) {
    throw new LearnerJourneyError("NOT_FOUND", "Learner not found or access is blocked by row scoping.");
  }
  return student;
}

export async function getLearnerJourneyTimeline(user: SessionUser, input: LearnerJourneyQueryInput) {
  assertRead(user);
  const query = learnerJourneyQuerySchema.parse(input);
  assertMode(user, query.mode);

  return withTenant(user.tenantId, async () => {
    const student = await assertScopedStudent(user, query.studentId);

    const entries: Array<ReturnType<typeof learnerJourneyEntrySchema.parse>> = [];
    const push = (entry: Parameters<typeof learnerJourneyEntrySchema.parse>[0]) => {
      const parsed = learnerJourneyEntrySchema.parse(entry);
      if (query.source && parsed.sourceModule !== query.source) return;
      if (query.mode === "parent" && parsed.visibility !== "PARENT_SAFE") return;
      if (!isWithinRange(parsed.date, query.from, query.to)) return;
      entries.push(parsed);
    };

    const wanted = (source: typeof LEARNER_JOURNEY_SOURCES[number]) => !query.source || query.source === source;

    if (wanted("EXAM")) await collectExamEntries(student.id, query.mode, push);
    if (wanted("ASSESSMENT")) await collectAssessmentEntries(student.id, query.mode, push);
    if (wanted("ATTENDANCE")) await collectAttendanceEntries(student.id, push);
    if (wanted("DISCIPLINE")) await collectDisciplineEntries(student.id, query.mode, push);
    if (wanted("COMPETENCY")) await collectCompetencyEntries(student.id, query.mode, push);
    if (wanted("SKILLS")) await collectSkillsEntries(student.id, push);
    if (!query.source || query.source === "PORTFOLIO" || query.source === "CERTIFICATE") {
      await collectPortfolioEntries(student.id, query.mode, query.source, push);
    }
    if (!query.source) await collectCommunityServiceEntries(student.id, query.mode, push);
    if (wanted("SYSTEM")) await collectSystemEntries(student.id, push);

    const sorted = entries.sort(sortEntries);
    const limited = sorted.slice(0, query.limit);
    const pins = await tenantDb().learnerJourneyPin.findMany({
      where: { studentId: student.id },
      orderBy: { pinnedAt: "desc" },
    });
    const visiblePins = query.mode === "parent"
      ? pins.filter((pin) => pin.visibility === "PARENT_SAFE")
      : pins;
    const pinMap = new Map(visiblePins.map((pin) => [pin.entryId, pin]));
    const decoratedLimited = limited.map((entry) => {
      const pin = pinMap.get(entry.id);
      if (!pin) return entry;
      return {
        ...entry,
        pinned: true,
        pinVisibility: pin.visibility as "STAFF" | "PARENT_SAFE",
        pinNote: pin.note ?? null,
      };
    });
    const sourceCounts = LEARNER_JOURNEY_SOURCES
      .map((source) => ({ source, count: sorted.filter((entry) => entry.sourceModule === source).length }))
      .filter((row) => row.count > 0);

    return {
      student: {
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        admissionNo: student.admissionNo,
        className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
        photoUrl: student.photoUrl,
      },
      mode: query.mode,
      filters: {
        from: query.from ?? null,
        to: query.to ?? null,
        source: query.source ?? "ALL",
        limit: query.limit,
      },
      summary: {
        totalEntries: sorted.length,
        returnedEntries: limited.length,
        sourceCounts,
      },
      entries: decoratedLimited,
    };
  });
}

export async function pinLearnerJourneyMilestone(user: SessionUser, input: LearnerJourneyPinInput) {
  assertPin(user);
  const payload = learnerJourneyPinSchema.parse(input);

  return withTenant(user.tenantId, async () => {
    const student = await assertScopedStudent(user, payload.studentId);
    const timeline = await getLearnerJourneyTimeline(user, {
      studentId: payload.studentId,
      mode: "staff",
      source: payload.sourceModule,
      limit: 200,
    });

    const matchedEntry = timeline.entries.find((entry) => entry.id === payload.entryId);
    if (!matchedEntry) {
      throw new LearnerJourneyError("INVALID", "Only real learner journey entries can be pinned.");
    }

    const pin = await tenantDb().learnerJourneyPin.upsert({
      where: {
        tenantId_studentId_entryId: {
          tenantId: user.tenantId,
          studentId: student.id,
          entryId: payload.entryId,
        },
      },
      create: {
        tenantId: user.tenantId,
        studentId: student.id,
        entryId: payload.entryId,
        sourceModule: payload.sourceModule,
        sourceRecordId: payload.sourceRecordId,
        note: payload.note,
        visibility: payload.visibility,
        pinnedById: user.id,
        pinnedByName: user.fullName,
      },
      update: {
        sourceModule: payload.sourceModule,
        sourceRecordId: payload.sourceRecordId,
        note: payload.note,
        visibility: payload.visibility,
        pinnedById: user.id,
        pinnedByName: user.fullName,
        pinnedAt: new Date(),
      },
    });

    await tenantDb().auditLog.create({
      data: {
        actorId: user.id,
        action: "learner_journey.milestone_pinned",
        entityType: "LearnerJourneyPin",
        entityId: pin.id,
        metadata: JSON.stringify({
          studentId: student.id,
          entryId: payload.entryId,
          sourceModule: payload.sourceModule,
          visibility: payload.visibility,
        }),
      },
    });

    return pin;
  });
}

export async function unpinLearnerJourneyMilestone(user: SessionUser, input: LearnerJourneyUnpinInput) {
  assertPin(user);
  const payload = learnerJourneyUnpinSchema.parse(input);

  return withTenant(user.tenantId, async () => {
    const student = await assertScopedStudent(user, payload.studentId);
    const existing = await tenantDb().learnerJourneyPin.findUnique({
      where: {
        tenantId_studentId_entryId: {
          tenantId: user.tenantId,
          studentId: student.id,
          entryId: payload.entryId,
        },
      },
    });

    if (!existing) {
      throw new LearnerJourneyError("NOT_FOUND", "Pinned learner milestone not found.");
    }

    await tenantDb().learnerJourneyPin.delete({ where: { id: existing.id } });

    await tenantDb().auditLog.create({
      data: {
        actorId: user.id,
        action: "learner_journey.milestone_unpinned",
        entityType: "LearnerJourneyPin",
        entityId: existing.id,
        metadata: JSON.stringify({
          studentId: student.id,
          entryId: payload.entryId,
          sourceModule: existing.sourceModule,
        }),
      },
    });

    return { success: true };
  });
}

export async function exportLearnerJourneyPack(user: SessionUser, input: LearnerJourneyQueryInput) {
  assertRead(user);
  const query = learnerJourneyQuerySchema.parse({
    ...input,
    mode: input.mode ?? "parent",
    limit: Math.min(input.limit ?? 120, 120),
  });

  return withTenant(user.tenantId, async () => {
    const timeline = await getLearnerJourneyTimeline(user, query);
    const verifyCode = await issueVerification(
      user.tenantId,
      "LEARNER_JOURNEY_EXPORT",
      `Learner Journey Export — ${timeline.student.name} (${timeline.student.admissionNo})`,
      {
        studentId: timeline.student.id,
        admissionNo: timeline.student.admissionNo,
        mode: timeline.mode,
        source: timeline.filters.source,
        totalEntries: timeline.entries.length,
      }
    );

    await tenantDb().auditLog.create({
      data: {
        actorId: user.id,
        action: "learner_journey.export_generated",
        entityType: "Student",
        entityId: timeline.student.id,
        metadata: JSON.stringify({
          studentId: timeline.student.id,
          admissionNo: timeline.student.admissionNo,
          mode: timeline.mode,
          source: timeline.filters.source,
          returnedEntries: timeline.entries.length,
          verifyCode,
        }),
      },
    });

    return {
      manifest: {
        version: "1.0",
        generatedAt: new Date().toISOString(),
        issuer: "NEYO Education OS",
        tenantId: user.tenantId,
      },
      learner: timeline.student,
      export: {
        verifyCode,
        transferFriendly: true,
        filters: {
          mode: timeline.mode,
          source: timeline.filters.source,
          from: timeline.filters.from,
          to: timeline.filters.to,
          limit: timeline.filters.limit,
        },
        notes: [
          "Source module labels are preserved so a receiving school can understand where each milestone came from.",
          "Visibility and verification fields are kept to support safe family sharing and internal school review.",
          "This export is read-only and reflects live learner records at the time it was generated.",
        ],
      },
      summary: timeline.summary,
      journey: timeline.entries,
    };
  });
}
