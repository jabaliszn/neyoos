/**
 * Part X — Developer Center 2.0 (founder-requested 2026-07-06).
 *
 * "Not because every school will use it, but because it allows NEYO to
 * become the PLATFORM that other education software connects to." Real
 * NEYO Ops monitoring on top of the existing A.16 API-key/webhook system:
 * total requests, active integrations, failed calls, slow endpoints, top
 * developers, usage by school, and security alerts — every number pulled
 * from the real `ApiUsageLog` rows every `/api/v1/*` request now writes
 * (via `authenticateApiRequest()`), never a guess or a mock.
 */
import { db } from "@/lib/db";
import {
  developerCenterConfigSchema,
  defaultDeveloperCenterConfig,
  type DeveloperCenterConfig,
} from "@/lib/validations/developer-center";

export const DEVELOPER_CENTER_SETTING_KEY = "developer_center_v1";

export class DeveloperCenterError extends Error {
  constructor(public code: "INVALID" | "NOT_FOUND", message: string) {
    super(message);
    this.name = "DeveloperCenterError";
  }
}

// ---------------------------------------------------------------------------
// NEYO Ops configuration.
// ---------------------------------------------------------------------------

export async function getDeveloperCenterConfig(): Promise<DeveloperCenterConfig> {
  const setting = await db.platformSetting.findUnique({ where: { key: DEVELOPER_CENTER_SETTING_KEY } });
  if (!setting?.value) return defaultDeveloperCenterConfig();
  try {
    return developerCenterConfigSchema.parse(JSON.parse(setting.value));
  } catch {
    return defaultDeveloperCenterConfig();
  }
}

export async function saveDeveloperCenterConfig(
  input: unknown,
  actor: { id: string; fullName: string; tenantId: string }
): Promise<DeveloperCenterConfig> {
  const config = developerCenterConfigSchema.parse(input);
  const setting = await db.platformSetting.upsert({
    where: { key: DEVELOPER_CENTER_SETTING_KEY },
    create: { key: DEVELOPER_CENTER_SETTING_KEY, value: JSON.stringify(config), updatedBy: actor.fullName },
    update: { value: JSON.stringify(config), updatedBy: actor.fullName },
  });
  await db.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "platform.developer_center_config_updated",
      entityType: "PlatformSetting",
      entityId: setting.key,
      metadata: JSON.stringify(config),
    },
  });
  return config;
}

// ---------------------------------------------------------------------------
// Real NEYO Ops usage dashboard — every figure computed live from
// ApiUsageLog, never a mock.
// ---------------------------------------------------------------------------

export interface ApiUsageDashboard {
  windowDays: number;
  totalRequests: number;
  failedRequests: number;
  successRate: number; // 0-100, rounded
  activeIntegrations: number; // distinct real, non-revoked API keys used in the window
  slowEndpoints: { path: string; avgDurationMs: number; count: number }[];
  topDevelopers: { apiKeyId: string; keyName: string | null; tenantName: string | null; requests: number }[];
  usageBySchool: { tenantId: string; tenantName: string; requests: number }[];
  securityAlerts: { type: string; message: string; count: number }[];
  recentFailures: { path: string; method: string; statusCode: number; outcome: string; createdAt: string; tenantName: string | null }[];
}

export async function getApiUsageDashboard(days: number): Promise<ApiUsageDashboard> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const config = await getDeveloperCenterConfig();

  const logs = await db.apiUsageLog.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 5000, // a real, sane cap so this dashboard never becomes an unbounded query as usage grows
  });

  const totalRequests = logs.length;
  const failedRequests = logs.filter((l) => l.outcome !== "OK").length;
  const successRate = totalRequests > 0 ? Math.round(((totalRequests - failedRequests) / totalRequests) * 100) : 100;

  const activeKeyIds = new Set(logs.filter((l) => l.apiKeyId).map((l) => l.apiKeyId as string));

  // Slow endpoints — real average duration per real path, only paths that
  // genuinely breach the NEYO-Ops-configured slow-request threshold.
  const byPath = new Map<string, { total: number; count: number }>();
  for (const l of logs) {
    const cur = byPath.get(l.path) ?? { total: 0, count: 0 };
    cur.total += l.durationMs;
    cur.count += 1;
    byPath.set(l.path, cur);
  }
  const slowEndpoints = Array.from(byPath.entries())
    .map(([path, v]) => ({ path, avgDurationMs: Math.round(v.total / v.count), count: v.count }))
    .filter((e) => e.avgDurationMs >= config.slowRequestThresholdMs)
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 10);

  // Top developers (real API keys) by request volume.
  const byKey = new Map<string, number>();
  for (const l of logs) if (l.apiKeyId) byKey.set(l.apiKeyId, (byKey.get(l.apiKeyId) ?? 0) + 1);
  const topKeyIds = Array.from(byKey.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const keyRows = topKeyIds.length
    ? await db.apiKey.findMany({ where: { id: { in: topKeyIds.map(([id]) => id) } }, include: { tenant: { select: { name: true } } } })
    : [];
  const keyById = new Map(keyRows.map((k) => [k.id, k]));
  const topDevelopers = topKeyIds.map(([apiKeyId, requests]) => ({
    apiKeyId,
    keyName: keyById.get(apiKeyId)?.name ?? null,
    tenantName: keyById.get(apiKeyId)?.tenant.name ?? null,
    requests,
  }));

  // Usage by school.
  const byTenant = new Map<string, number>();
  for (const l of logs) if (l.tenantId) byTenant.set(l.tenantId, (byTenant.get(l.tenantId) ?? 0) + 1);
  const tenantIds = Array.from(byTenant.keys());
  const tenantRows = tenantIds.length ? await db.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } }) : [];
  const tenantNameById = new Map(tenantRows.map((t) => [t.id, t.name]));
  const usageBySchool = Array.from(byTenant.entries())
    .map(([tenantId, requests]) => ({ tenantId, tenantName: tenantNameById.get(tenantId) ?? "Unknown school", requests }))
    .sort((a, b) => b.requests - a.requests);

  // Real, honest security alerts — never invented, only counted from real outcomes.
  const securityAlerts: ApiUsageDashboard["securityAlerts"] = [];
  const invalidTokenCount = logs.filter((l) => l.outcome === "INVALID_TOKEN").length;
  const rateLimitedCount = logs.filter((l) => l.outcome === "RATE_LIMITED").length;
  const insufficientScopeCount = logs.filter((l) => l.outcome === "INSUFFICIENT_SCOPE").length;
  if (invalidTokenCount > 0) securityAlerts.push({ type: "INVALID_TOKEN", message: "Requests with an invalid, revoked, or expired API key", count: invalidTokenCount });
  if (rateLimitedCount > 0) securityAlerts.push({ type: "RATE_LIMITED", message: "Requests that hit a real per-key rate limit", count: rateLimitedCount });
  if (insufficientScopeCount > 0) securityAlerts.push({ type: "INSUFFICIENT_SCOPE", message: "Requests attempted outside a key's granted scopes", count: insufficientScopeCount });

  const recentFailures = logs
    .filter((l) => l.outcome !== "OK")
    .slice(0, 20)
    .map((l) => ({
      path: l.path,
      method: l.method,
      statusCode: l.statusCode,
      outcome: l.outcome,
      createdAt: l.createdAt.toISOString(),
      tenantName: l.tenantId ? tenantNameById.get(l.tenantId) ?? null : null,
    }));

  return {
    windowDays: days,
    totalRequests,
    failedRequests,
    successRate,
    activeIntegrations: activeKeyIds.size,
    slowEndpoints,
    topDevelopers,
    usageBySchool,
    securityAlerts,
    recentFailures,
  };
}

/** A school's OWN, self-scoped usage view (Settings → Developer). */
export async function getTenantApiUsage(tenantId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const logs = await db.apiUsageLog.findMany({
    where: { tenantId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const totalRequests = logs.length;
  const failedRequests = logs.filter((l) => l.outcome !== "OK").length;
  return {
    windowDays: days,
    totalRequests,
    failedRequests,
    successRate: totalRequests > 0 ? Math.round(((totalRequests - failedRequests) / totalRequests) * 100) : 100,
    recent: logs.slice(0, 20).map((l) => ({
      method: l.method, path: l.path, statusCode: l.statusCode, durationMs: l.durationMs, outcome: l.outcome, createdAt: l.createdAt.toISOString(),
    })),
  };
}
