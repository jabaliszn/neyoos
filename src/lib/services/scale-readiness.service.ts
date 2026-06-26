import { db } from "@/lib/db";
import { isRedisQueueConfigured } from "@/lib/jobs/bullmq-adapter";
import { STORAGE_CONFIGURED } from "@/lib/storage/provider";

export type ScaleStatus = "ready" | "partial" | "missing";

function status(ok: boolean, partial = false): ScaleStatus {
  if (ok) return "ready";
  return partial ? "partial" : "missing";
}

function isPostgresUrl(url?: string) {
  return Boolean(url?.startsWith("postgres://") || url?.startsWith("postgresql://"));
}

function isSqliteUrl(url?: string) {
  return Boolean(url?.startsWith("file:"));
}

export async function getScaleReadiness() {
  const databaseUrl = process.env.DATABASE_URL || "";
  const redisConfigured = await isRedisQueueConfigured();
  const checks = [
    {
      key: "database_postgres",
      label: "Production Postgres database",
      status: status(isPostgresUrl(databaseUrl), isSqliteUrl(databaseUrl)),
      detail: isPostgresUrl(databaseUrl) ? "Postgres URL detected." : isSqliteUrl(databaseUrl) ? "SQLite dev database detected; use Neon/Postgres for scale." : "DATABASE_URL is missing or not recognized.",
    },
    {
      key: "database_pooling",
      label: "Connection pooling",
      status: status(/pool|pgbouncer|neon/i.test(databaseUrl), isPostgresUrl(databaseUrl)),
      detail: /pool|pgbouncer|neon/i.test(databaseUrl) ? "Pooling/pooler-like URL detected." : "Use Neon pooled connection string or PgBouncer before scale.",
    },
    {
      key: "redis_queue",
      label: "Redis-backed jobs and queues",
      status: status(redisConfigured),
      detail: redisConfigured ? "Redis URL configured from NEYO Ops vault or env." : "Redis URL missing; jobs run in-process only.",
    },
    {
      key: "object_storage",
      label: "External object storage",
      status: status(STORAGE_CONFIGURED),
      detail: STORAGE_CONFIGURED ? "R2/S3 storage configured." : "R2/S3 env missing; local storage is dev-only.",
    },
    {
      key: "encrypted_uploads",
      label: "Encrypted upload path",
      status: "ready" as ScaleStatus,
      detail: "Reusable FileUpload uses /api/files/encrypted; legacy direct uploads are locked.",
    },
    {
      key: "worker",
      label: "Dedicated worker process",
      status: status(Boolean(redisConfigured && process.env.WORKER_ENABLED === "true"), redisConfigured),
      detail: process.env.WORKER_ENABLED === "true" ? "Worker flag enabled." : "Set WORKER_ENABLED=true and deploy worker for durable queues.",
    },
    {
      key: "observability",
      label: "Observability",
      status: status(Boolean(process.env.SENTRY_DSN || process.env.LOGTAIL_TOKEN || process.env.BETTER_STACK_TOKEN), false),
      detail: "Configure Sentry and Better Stack/Logtail before launch campaigns.",
    },
    {
      key: "cron_secret",
      label: "Cron protection",
      status: status(Boolean(process.env.CRON_SECRET)),
      detail: process.env.CRON_SECRET ? "CRON_SECRET configured." : "CRON_SECRET missing; scheduled jobs endpoint must be protected.",
    },
    {
      key: "master_kek",
      label: "Master encryption key",
      status: status(Boolean(process.env.NEYO_MASTER_KEK)),
      detail: process.env.NEYO_MASTER_KEK ? "NEYO_MASTER_KEK configured." : "NEYO_MASTER_KEK missing; production encryption requires a managed secret/KMS.",
    },
  ];

  let dbLatencyMs: number | null = null;
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
  } catch {
    checks.push({ key: "db_ping", label: "Database ping", status: "missing", detail: "Database ping failed." });
  }

  const ready = checks.filter((c) => c.status === "ready").length;
  const partial = checks.filter((c) => c.status === "partial").length;
  const missing = checks.filter((c) => c.status === "missing").length;
  const overall: ScaleStatus = missing === 0 && partial === 0 ? "ready" : ready >= checks.length / 2 ? "partial" : "missing";

  return {
    target: "2,000,000 active users",
    overall,
    ready,
    partial,
    missing,
    dbLatencyMs,
    checks,
    recommendation: overall === "ready" ? "Production infrastructure is ready for load testing." : "Complete missing production infrastructure, then run load tests before claiming 2M readiness.",
    generatedAt: new Date().toISOString(),
  };
}
