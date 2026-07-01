/**
 * Background job registry (Feature A.12).
 * Each job has a name and a handler that receives a `progress` reporter.
 * Add new jobs here; they become enqueue-able + cron-schedulable automatically.
 */
import { runSubscriptionStateMachine } from "@/lib/services/billing.service";
import { retryDueDeliveries } from "@/lib/services/webhook.service";
import { db } from "@/lib/db";

export interface JobContext {
  payload?: unknown;
  progress: (pct: number) => Promise<void>;
}

export type JobHandler = (ctx: JobContext) => Promise<unknown>;

/** Auto-purge recycle-bin items older than N days (G.6 + A.12). */
async function recyclePurge(ctx: JobContext): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
  await ctx.progress(20);
  const res = await db.payment.deleteMany({
    where: { NOT: { deletedAt: null }, deletedAt: { lt: cutoff } },
  });
  await ctx.progress(100);
  return { purged: res.count };
}

/** Subscription state machine tick (A.5). */
async function subscriptionTick(ctx: JobContext): Promise<{ changed: number }> {
  await ctx.progress(10);
  const changed = await runSubscriptionStateMachine();
  await ctx.progress(100);
  return { changed };
}

/** Overdue fee reminders for every tenant (B.7.12). */
async function feeReminders(ctx: JobContext) {
  await ctx.progress(10);
  const { sendFeeReminders } = await import("@/lib/services/finance.service");
  const tenants = await db.tenant.findMany({ select: { id: true } });
  let sent = 0; let skipped = 0;
  for (const t of tenants) {
    const r = await sendFeeReminders(t.id);
    sent += r.sent; skipped += r.skipped;
  }
  await ctx.progress(100);
  return { sent, skipped };
}

/** Retry due webhook deliveries with exponential backoff (A.16.6). */
async function webhookDeliver(ctx: JobContext) {
  await ctx.progress(20);
  const summary = await retryDueDeliveries();
  await ctx.progress(100);
  return summary;
}

/** G.14 — hard-delete demo tenants past their 24h expiry. */
async function demoPurge(ctx: JobContext) {
  await ctx.progress(10);
  const { purgeExpiredDemos } = await import("@/lib/services/demo.service");
  const summary = await purgeExpiredDemos();
  await ctx.progress(100);
  return summary;
}

/** G.15 — Monday weekly Term Trends Pulse digest to leadership (all tenants). */
async function termPulse(ctx: JobContext) {
  await ctx.progress(10);
  const { sendWeeklyPulse } = await import("@/lib/services/term-pulse.service");
  const summary = await sendWeeklyPulse();
  await ctx.progress(100);
  return summary;
}

/** G.8 Polish + J.22 Compliance — data retention / auto-archive scheduler. */
async function dataRetention(ctx: JobContext): Promise<{
  notificationsPurged: number;
  auditsArchived: number;
  expiredPassportsPurged: number;
  oldPortfoliosPurged: number;
}> {
  await ctx.progress(15);
  const notifCutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000); // 90 days
  const resNotif = await db.notification.deleteMany({
    where: { NOT: { readAt: null }, readAt: { lt: notifCutoff } },
  });

  await ctx.progress(45);
  // Compliance audit log retention (e.g., older than 7 years soft archive or purge)
  const auditCutoff = new Date(Date.now() - 7 * 365 * 24 * 3600 * 1000); // 7 years
  const resAudit = await db.auditLog.deleteMany({
    where: { createdAt: { lt: auditCutoff } },
  });

  await ctx.progress(70);
  // J.22 — run the real compliance retention engine: wipe expired transfer
  // passport payloads (data minimization) and purge stale unapproved portfolio
  // evidence. Previously this engine existed but was never invoked (dead code).
  const { enforceDataRetentionPolicies } = await import("@/lib/services/retention.service");
  const compliance = await enforceDataRetentionPolicies();

  await ctx.progress(100);
  return {
    notificationsPurged: resNotif.count,
    auditsArchived: resAudit.count,
    expiredPassportsPurged: compliance.expiredPassportsPurged,
    oldPortfoliosPurged: compliance.oldPortfoliosPurged,
  };
}



/** I.85 — 24-hour sender-facing read/ack delivery reports. */
async function messageDeliveryReports(ctx: JobContext) {
  await ctx.progress(20);
  const { generateDueMessageDeliveryReports } = await import("@/lib/services/messaging.service");
  const summary = await generateDueMessageDeliveryReports();
  await ctx.progress(100);
  return summary;
}

/** I.85 — urgent message SMS fallback for recipients who have not read/acknowledged. */
async function messageFallback(ctx: JobContext) {
  await ctx.progress(20);
  const { sendUnreadMessageFallbacks } = await import("@/lib/services/messaging.service");
  const summary = await sendUnreadMessageFallbacks();
  await ctx.progress(100);
  return summary;
}


/** I.99 — daily finance digest to bursar/principal. */
async function financeDigestDaily(ctx: JobContext) {
  await ctx.progress(10);
  const { sendFinanceDigest } = await import("@/lib/services/finance.service");
  const tenants = await db.tenant.findMany({ select: { id: true } });
  let sentSms = 0, sentInApp = 0;
  for (const t of tenants) { const r = await sendFinanceDigest(t.id, "daily"); sentSms += r.sentSms; sentInApp += r.sentInApp; }
  await ctx.progress(100);
  return { sentSms, sentInApp };
}

/** I.99 — weekly finance digest to bursar/principal. */
async function financeDigestWeekly(ctx: JobContext) {
  await ctx.progress(10);
  const { sendFinanceDigest } = await import("@/lib/services/finance.service");
  const tenants = await db.tenant.findMany({ select: { id: true } });
  let sentSms = 0, sentInApp = 0;
  for (const t of tenants) { const r = await sendFinanceDigest(t.id, "weekly"); sentSms += r.sentSms; sentInApp += r.sentInApp; }
  await ctx.progress(100);
  return { sentSms, sentInApp };
}


/** I.56 — daily Storage Vault health/quota checks. */
async function storageHealthCheck(ctx: JobContext) {
  await ctx.progress(10);
  const { runStorageHealthChecks } = await import("@/lib/services/storage-vault.service");
  const summary = await runStorageHealthChecks();
  await ctx.progress(100);
  return summary;
}

/** G.28 — check and auto-flag broken/kept promises. */
async function promiseCheck(ctx: JobContext) {
  await ctx.progress(10);
  const { checkBrokenPromises } = await import("@/lib/services/promise-to-pay.service");
  const tenants = await db.tenant.findMany({ select: { id: true } });
  let broken = 0; let kept = 0;
  for (const t of tenants) {
    const r = await checkBrokenPromises(t.id);
    broken += r.brokenCount; kept += r.keptCount;
  }
  await ctx.progress(100);
  return { broken, kept };
}

export const JOBS: Record<string, JobHandler> = {
  "subscription-state-machine": subscriptionTick,
  "recycle-purge": recyclePurge,
  "webhook-deliver": webhookDeliver,
  "fee-reminders": feeReminders,
  "demo-purge": demoPurge,
  "term-pulse": termPulse,
  "data-retention": dataRetention,
  "promise-check": promiseCheck,
  "message-fallback": messageFallback,
  "message-delivery-reports": messageDeliveryReports,
  "finance-digest-daily": financeDigestDaily,
  "finance-digest-weekly": financeDigestWeekly,
  "storage-health-check": storageHealthCheck,
};

export function isJob(name: string): boolean {
  return name in JOBS;
}

/**
 * Cron schedules in Africa/Nairobi time (A.12). `hour`/`minute` are local to
 * Nairobi (UTC+3, no DST). The tick endpoint computes which are due.
 */
export interface CronDef {
  name: string; // job name
  hour: number; // 0-23 Nairobi time
  minute: number; // 0-59
  /** Optional Nairobi day-of-week (0=Sun … 6=Sat). Omit = run every day. */
  dow?: number;
  description: string;
}

export const CRON_SCHEDULES: CronDef[] = [
  { name: "subscription-state-machine", hour: 1, minute: 0, description: "Daily 01:00 EAT — advance subscription states" },
  { name: "recycle-purge", hour: 2, minute: 0, description: "Daily 02:00 EAT — purge recycle bin >30 days" },
  { name: "fee-reminders", hour: 9, minute: 0, description: "Daily 09:00 EAT — SMS overdue fee reminders (3-day dedupe)" },
  { name: "demo-purge", hour: 3, minute: 0, description: "Daily 03:00 EAT — hard-delete expired demo tenants (G.14)" },
  { name: "term-pulse", hour: 7, minute: 0, dow: 1, description: "Monday 07:00 EAT — weekly Term Trends Pulse digest to leadership (G.15)" },
  { name: "data-retention", hour: 4, minute: 0, description: "Daily 04:00 EAT — auto-archive / purge old notifications and old logs (G.8)" },
  { name: "promise-check", hour: 3, minute: 15, description: "Daily 03:15 EAT — check and auto-flag broken/kept fee promises (G.28)" },
  { name: "finance-digest-daily", hour: 17, minute: 30, description: "Daily 17:30 EAT — fees digest to bursar and principal (I.99)" },
  { name: "finance-digest-weekly", hour: 7, minute: 30, dow: 1, description: "Monday 07:30 EAT — weekly fees digest to bursar and principal (I.99)" },
  { name: "storage-health-check", hour: 6, minute: 15, description: "Daily 06:15 EAT — Storage Vault quota/health checks and upgrade warnings (I.56)" },
];

/**
 * Jobs that should run on EVERY tick (the scheduler hits /api/jobs/tick each
 * minute). The webhook retry queue (A.16.6) needs frequent polling so failed
 * deliveries are re-attempted promptly once their backoff window elapses.
 */
export const EVERY_MINUTE_JOBS: string[] = ["webhook-deliver", "message-fallback", "message-delivery-reports"];

export const NAIROBI_OFFSET_MIN = 180; // UTC+3

/** Current Nairobi {hour, minute} from a Date (UTC-based). */
export function nairobiTime(now = new Date()): { hour: number; minute: number } {
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const local = (utcMin + NAIROBI_OFFSET_MIN) % (24 * 60);
  return { hour: Math.floor(local / 60), minute: local % 60 };
}

/** Current Nairobi day-of-week (0=Sun … 6=Sat) from a Date (UTC-based). */
export function nairobiDow(now = new Date()): number {
  // Shift the instant into Nairobi local time, then read its UTC weekday.
  const local = new Date(now.getTime() + NAIROBI_OFFSET_MIN * 60_000);
  return local.getUTCDay();
}
