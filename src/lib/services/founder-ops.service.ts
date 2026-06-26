/**
 * PART F.1 — Internal NEYO Founder Operations service.
 *
 * Company-level service for NEYO eating its own food. These records are NOT
 * tenant-owned and deliberately use the root Prisma client (`db`), not tenantDb().
 * API callers must be SUPER_ADMIN (enforced in Chunk 4 routes).
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type {
  NeyoBuildLogInput,
  NeyoMetricSnapshotInput,
  NeyoFounderOpsEntryInput,
  NeyoCustomerInterviewInput,
  FounderOpsListQuery,
} from "@/lib/validations/founder-ops";

export class FounderOpsError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "INVALID", message: string) {
    super(message);
    this.name = "FounderOpsError";
  }
}

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function jsonArray(value: unknown[] | undefined) {
  return value && value.length > 0 ? JSON.stringify(value) : null;
}

function jsonObject(value: Record<string, unknown> | undefined) {
  return value && Object.keys(value).length > 0 ? JSON.stringify(value) : null;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function actor(user: SessionUser) {
  return { createdById: user.id, createdByName: user.fullName };
}

function duplicateToDomain(err: unknown, message: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new FounderOpsError("DUPLICATE", message);
  }
  throw err;
}

function mapBuildLog(row: any) {
  return {
    ...row,
    screenshotRefs: parseJson<string[]>(row.screenshotRefs, []),
  };
}

function mapOpsEntry(row: any) {
  return {
    ...row,
    decisions: parseJson<string[]>(row.decisionsJson, []),
    actionItems: parseJson<Array<{ task: string; owner?: string; dueOn?: string; done: boolean }>>(row.actionItemsJson, []),
    metrics: parseJson<Record<string, unknown>>(row.metricsJson, {}),
  };
}

function mapInterview(row: any) {
  return {
    ...row,
    painPoints: parseJson<string[]>(row.painPointsJson, []),
    quotes: parseJson<string[]>(row.quotesJson, []),
    opportunities: parseJson<string[]>(row.opportunitiesJson, []),
  };
}

export async function founderOpsDashboard() {
  const [
    latestBuildLogs,
    latestMetric,
    upcomingEntries,
    recentEntries,
    upcomingInterviews,
    recentInterviews,
    counts,
  ] = await Promise.all([
    db.neyoBuildLog.findMany({ orderBy: { dateKey: "desc" }, take: 5 }),
    db.neyoMetricSnapshot.findFirst({ orderBy: { periodStart: "desc" } }),
    db.neyoFounderOpsEntry.findMany({
      where: { status: "PLANNED" },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
      take: 8,
    }),
    db.neyoFounderOpsEntry.findMany({
      where: { status: "DONE" },
      orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    db.neyoCustomerInterview.findMany({
      where: { status: "SCHEDULED" },
      orderBy: [{ interviewDate: "asc" }, { createdAt: "desc" }],
      take: 8,
    }),
    db.neyoCustomerInterview.findMany({
      where: { status: "DONE" },
      orderBy: [{ interviewDate: "desc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    Promise.all([
      db.neyoBuildLog.count(),
      db.neyoBuildLog.count({ where: { status: "PUBLISHED" } }),
      db.neyoFounderOpsEntry.count({ where: { status: "PLANNED" } }),
      db.neyoFounderOpsEntry.count({ where: { status: "DONE" } }),
      db.neyoCustomerInterview.count({ where: { status: "SCHEDULED" } }),
      db.neyoCustomerInterview.count({ where: { status: "DONE" } }),
    ]),
  ]);

  return {
    latestBuildLogs: latestBuildLogs.map(mapBuildLog),
    latestMetric,
    upcomingEntries: upcomingEntries.map(mapOpsEntry),
    recentEntries: recentEntries.map(mapOpsEntry),
    upcomingInterviews: upcomingInterviews.map(mapInterview),
    recentInterviews: recentInterviews.map(mapInterview),
    counts: {
      buildLogs: counts[0],
      publishedBuildLogs: counts[1],
      plannedOps: counts[2],
      completedOps: counts[3],
      scheduledInterviews: counts[4],
      completedInterviews: counts[5],
    },
  };
}

// ---------------------------------------------------------------------------
// Build logs
// ---------------------------------------------------------------------------
export async function listBuildLogs(limit = 50) {
  const rows = await db.neyoBuildLog.findMany({
    orderBy: { dateKey: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map(mapBuildLog);
}

export async function upsertBuildLog(user: SessionUser, input: NeyoBuildLogInput) {
  try {
    const row = await db.neyoBuildLog.upsert({
      where: { dateKey: input.dateKey },
      update: {
        title: input.title,
        shippedSummary: input.shippedSummary,
        details: clean(input.details),
        screenshotRefs: jsonArray(input.screenshotRefs),
        commitRef: clean(input.commitRef),
        status: input.status,
      },
      create: {
        dateKey: input.dateKey,
        title: input.title,
        shippedSummary: input.shippedSummary,
        details: clean(input.details),
        screenshotRefs: jsonArray(input.screenshotRefs),
        commitRef: clean(input.commitRef),
        status: input.status,
        ...actor(user),
      },
    });
    return mapBuildLog(row);
  } catch (err) {
    duplicateToDomain(err, "A build log already exists for this date.");
  }
}

export async function deleteBuildLog(id: string) {
  const existing = await db.neyoBuildLog.findUnique({ where: { id } });
  if (!existing) throw new FounderOpsError("NOT_FOUND", "Build log not found.");
  await db.neyoBuildLog.delete({ where: { id } });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Metrics snapshots
// ---------------------------------------------------------------------------
export async function listMetricSnapshots(limit = 50) {
  return db.neyoMetricSnapshot.findMany({
    orderBy: { periodStart: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
}

export async function upsertMetricSnapshot(user: SessionUser, input: NeyoMetricSnapshotInput) {
  try {
    return await db.neyoMetricSnapshot.upsert({
      where: { periodKey: input.periodKey },
      update: {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        revenueKes: input.revenueKes,
        mrrKes: input.mrrKes,
        payingSchools: input.payingSchools,
        trialSchools: input.trialSchools,
        activeSchools: input.activeSchools,
        churnRiskSchools: input.churnRiskSchools,
        smsSpendKes: input.smsSpendKes,
        notes: clean(input.notes),
      },
      create: {
        periodKey: input.periodKey,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        revenueKes: input.revenueKes,
        mrrKes: input.mrrKes,
        payingSchools: input.payingSchools,
        trialSchools: input.trialSchools,
        activeSchools: input.activeSchools,
        churnRiskSchools: input.churnRiskSchools,
        smsSpendKes: input.smsSpendKes,
        notes: clean(input.notes),
        ...actor(user),
      },
    });
  } catch (err) {
    duplicateToDomain(err, "A metrics snapshot already exists for this period.");
  }
}

export async function deleteMetricSnapshot(id: string) {
  const existing = await db.neyoMetricSnapshot.findUnique({ where: { id } });
  if (!existing) throw new FounderOpsError("NOT_FOUND", "Metric snapshot not found.");
  await db.neyoMetricSnapshot.delete({ where: { id } });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Founder operating cadence entries
// ---------------------------------------------------------------------------
export async function listFounderOpsEntries(query: Partial<FounderOpsListQuery> = {}) {
  const rows = await db.neyoFounderOpsEntry.findMany({
    where: {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(query.limit ?? 50, 1), 100),
  });
  return rows.map(mapOpsEntry);
}

export async function upsertFounderOpsEntry(user: SessionUser, input: NeyoFounderOpsEntryInput) {
  const periodKey = clean(input.periodKey) ?? `${input.kind}-${input.scheduledFor || Date.now()}`;
  try {
    const row = await db.neyoFounderOpsEntry.upsert({
      where: { kind_periodKey: { kind: input.kind, periodKey } },
      update: {
        title: input.title,
        status: input.status,
        scheduledFor: clean(input.scheduledFor),
        completedAt: input.completedAt ?? null,
        summary: clean(input.summary),
        notes: clean(input.notes),
        decisionsJson: jsonArray(input.decisions),
        actionItemsJson: jsonArray(input.actionItems),
        metricsJson: jsonObject(input.metrics),
        audience: clean(input.audience),
      },
      create: {
        kind: input.kind,
        periodKey,
        title: input.title,
        status: input.status,
        scheduledFor: clean(input.scheduledFor),
        completedAt: input.completedAt ?? null,
        summary: clean(input.summary),
        notes: clean(input.notes),
        decisionsJson: jsonArray(input.decisions),
        actionItemsJson: jsonArray(input.actionItems),
        metricsJson: jsonObject(input.metrics),
        audience: clean(input.audience),
        ...actor(user),
      },
    });
    return mapOpsEntry(row);
  } catch (err) {
    duplicateToDomain(err, "A founder-ops entry already exists for this kind and period.");
  }
}

export async function deleteFounderOpsEntry(id: string) {
  const existing = await db.neyoFounderOpsEntry.findUnique({ where: { id } });
  if (!existing) throw new FounderOpsError("NOT_FOUND", "Founder-ops entry not found.");
  await db.neyoFounderOpsEntry.delete({ where: { id } });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Customer interviews
// ---------------------------------------------------------------------------
export async function listCustomerInterviews(limit = 50, status?: string) {
  const rows = await db.neyoCustomerInterview.findMany({
    where: { ...(status ? { status } : {}) },
    orderBy: [{ interviewDate: "desc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map(mapInterview);
}

export async function createCustomerInterview(user: SessionUser, input: NeyoCustomerInterviewInput) {
  const row = await db.neyoCustomerInterview.create({
    data: {
      schoolName: input.schoolName,
      contactName: input.contactName,
      contactRole: clean(input.contactRole),
      phone: clean(input.phone),
      email: clean(input.email),
      county: clean(input.county),
      interviewDate: input.interviewDate,
      channel: input.channel,
      status: input.status,
      painPointsJson: jsonArray(input.painPoints),
      quotesJson: jsonArray(input.quotes),
      opportunitiesJson: jsonArray(input.opportunities),
      followUp: clean(input.followUp),
      ...actor(user),
    },
  });
  return mapInterview(row);
}

export async function updateCustomerInterview(id: string, input: NeyoCustomerInterviewInput) {
  const existing = await db.neyoCustomerInterview.findUnique({ where: { id } });
  if (!existing) throw new FounderOpsError("NOT_FOUND", "Customer interview not found.");
  const row = await db.neyoCustomerInterview.update({
    where: { id },
    data: {
      schoolName: input.schoolName,
      contactName: input.contactName,
      contactRole: clean(input.contactRole),
      phone: clean(input.phone),
      email: clean(input.email),
      county: clean(input.county),
      interviewDate: input.interviewDate,
      channel: input.channel,
      status: input.status,
      painPointsJson: jsonArray(input.painPoints),
      quotesJson: jsonArray(input.quotes),
      opportunitiesJson: jsonArray(input.opportunities),
      followUp: clean(input.followUp),
    },
  });
  return mapInterview(row);
}

export async function deleteCustomerInterview(id: string) {
  const existing = await db.neyoCustomerInterview.findUnique({ where: { id } });
  if (!existing) throw new FounderOpsError("NOT_FOUND", "Customer interview not found.");
  await db.neyoCustomerInterview.delete({ where: { id } });
  return { success: true };
}
