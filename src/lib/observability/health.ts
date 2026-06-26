/**
 * Health checks (Feature A.13). Powers /api/health (deep) and the /status page.
 * Real checks against the DB; extend with Redis/R2 when those are configured.
 */
import { db } from "@/lib/db";
import { isRedisQueueConfigured } from "@/lib/jobs/bullmq-adapter";
import { STORAGE_CONFIGURED } from "@/lib/storage/provider";

export interface Check {
  name: string;
  status: "operational" | "degraded" | "down" | "not_configured";
  detail?: string;
  latencyMs?: number;
}

async function checkDatabase(): Promise<Check> {
  const t0 = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { name: "Database", status: "operational", latencyMs: Date.now() - t0 };
  } catch (e) {
    return { name: "Database", status: "down", detail: (e as Error).message };
  }
}

export async function runHealthChecks(): Promise<{
  status: "operational" | "degraded" | "down";
  checks: Check[];
  time: string;
}> {
  const checks: Check[] = [];

  checks.push(await checkDatabase());

  // Optional infra: report configured/not — "not_configured" is not "down".
  const redisConfigured = await isRedisQueueConfigured();
  checks.push({
    name: "Background jobs (Redis)",
    status: redisConfigured ? "operational" : "not_configured",
    detail: redisConfigured ? "Redis/Upstash queue configured" : "Running in-process (no Redis yet)",
  });
  checks.push({
    name: "File storage",
    status: STORAGE_CONFIGURED ? "operational" : "not_configured",
    detail: STORAGE_CONFIGURED ? "Cloudflare R2" : "Local dev storage",
  });

  // Overall: down if any core check is down; degraded if any is degraded.
  const core = checks.filter((c) => c.name === "Database");
  const overall: "operational" | "degraded" | "down" = core.some((c) => c.status === "down")
    ? "down"
    : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "operational";

  return { status: overall, checks, time: new Date().toISOString() };
}
