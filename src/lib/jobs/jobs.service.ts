/**
 * Background jobs service (Feature A.12).
 * - runJob: executes a registered job with retry + exponential backoff and
 *   live progress, recording a JobRun row.
 * - enqueue: in dev runs immediately; with Redis (BullMQ) it pushes to a queue
 *   that a separate worker drains.
 * - dueCronJobs: which scheduled jobs are due at the current Nairobi minute.
 */
import { db } from "@/lib/db";
import {
  JOBS,
  isJob,
  CRON_SCHEDULES,
  EVERY_MINUTE_JOBS,
  nairobiTime,
  nairobiDow,
} from "@/lib/jobs/registry";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 1000, 4000]; // exponential-ish

export const REDIS_ENABLED = Boolean(process.env.REDIS_URL); // legacy sync hint; use isRedisQueueConfigured() for vault-aware checks.

export class JobError extends Error {
  constructor(public code: "UNKNOWN_JOB", message: string) {
    super(message);
    this.name = "JobError";
  }
}

/** Execute a job now, with retry + backoff + progress + a JobRun record. */
export async function runJob(name: string, payload?: unknown) {
  if (!isJob(name)) throw new JobError("UNKNOWN_JOB", `Unknown job: ${name}`);
  const handler = JOBS[name];

  const run = await db.jobRun.create({
    data: {
      name,
      status: "RUNNING",
      payload: payload ? JSON.stringify(payload) : null,
      startedAt: new Date(),
    },
  });

  const progress = async (pct: number) => {
    await db.jobRun.update({
      where: { id: run.id },
      data: { progress: Math.max(0, Math.min(100, Math.round(pct))) },
    });
  };

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) {
        await db.jobRun.update({ where: { id: run.id }, data: { attempts: attempt } });
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 4000));
      } else {
        await db.jobRun.update({ where: { id: run.id }, data: { attempts: 1 } });
      }
      const result = await handler({ payload, progress });
      await db.jobRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          progress: 100,
          result: JSON.stringify(result ?? {}),
          finishedAt: new Date(),
        },
      });
      return { ok: true, runId: run.id, result };
    } catch (e) {
      lastError = e;
    }
  }

  await db.jobRun.update({
    where: { id: run.id },
    data: {
      status: "FAILED",
      error: (lastError as Error)?.message ?? "Job failed",
      finishedAt: new Date(),
    },
  });
  return { ok: false, runId: run.id, error: (lastError as Error)?.message };
}

/**
 * Enqueue a job. With Redis/BullMQ it pushes to the queue (drained by a
 * separate worker); without Redis it runs in-process immediately (dev).
 */
export async function enqueue(name: string, payload?: unknown) {
  if (!isJob(name)) throw new JobError("UNKNOWN_JOB", `Unknown job: ${name}`);
  const { addToQueue, isRedisQueueConfigured } = await import("@/lib/jobs/bullmq-adapter");
  if (await isRedisQueueConfigured()) {
    await addToQueue(name, payload);
    return { ok: true, queued: true };
  }
  // Dev fallback: run now.
  return runJob(name, payload);
}

/** Which cron jobs are due at the current Nairobi minute (idempotent-ish). */
export function dueCronJobs(now = new Date()): string[] {
  const { hour, minute } = nairobiTime(now);
  const dow = nairobiDow(now);
  const scheduled = CRON_SCHEDULES.filter(
    (c) =>
      c.hour === hour &&
      c.minute === minute &&
      // dow undefined = every day; otherwise must match the Nairobi weekday.
      (c.dow === undefined || c.dow === dow)
  ).map((c) => c.name);
  // Every-minute jobs (e.g. webhook retry queue) always run.
  return Array.from(new Set([...EVERY_MINUTE_JOBS, ...scheduled]));
}

/**
 * Cron tick: run all due jobs. A real scheduler hits this every minute; we
 * also let it run jobs forced via `only`.
 */
export async function tick(opts?: { only?: string; force?: boolean }) {
  const names = opts?.only ? [opts.only] : dueCronJobs();
  const ran: { name: string; ok: boolean }[] = [];
  for (const name of names) {
    const r = opts?.force || opts?.only ? await runJob(name) : await enqueue(name);
    ran.push({ name, ok: "ok" in r ? r.ok : true });
  }
  return { ran };
}

/** Recent job runs for the admin panel. */
export async function recentRuns(limit = 25) {
  return db.jobRun.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
