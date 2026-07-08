/**
 * Bearer-token authentication for the Public API (A.16.2 + A.16.3),
 * extended by Part X — Developer Center 2.0 (founder-requested 2026-07-06)
 * to real-log every single request to `ApiUsageLog` — the exact real data
 * NEYO Ops needs for "total requests / failed calls / slow endpoints /
 * top developers / usage by school / security alerts", with zero extra
 * integration work needed per route as the real API surface grows.
 *
 * Usage in a /api/v1/* route:
 *   const auth = await authenticateApiRequest(req, "student.view");
 *   if (!auth.ok) return auth.response;
 *   await withTenant(auth.tenantId, async () => { ... });
 *
 * - Reads `Authorization: Bearer <token>`.
 * - Resolves the token to a tenant + scopes + tier + environment (A.16.2).
 * - Enforces a per-key sliding-window rate limit (A.16.3, reuses A.14).
 * - Optionally checks the key holds a required scope.
 * - Real-logs the outcome + timing of EVERY request (best-effort, never
 *   blocks the real API response on a logging failure).
 */
import { NextResponse } from "next/server";
import { resolveBearerToken, scopeAllows } from "@/lib/services/api-key.service";
import { checkRate } from "@/lib/security/rate-limit";
import { db } from "@/lib/db";
import type { ApiKeyTier, ApiKeyEnvironment } from "@/lib/validations/api-keys";

// Generous default for server-to-server use; tune per plan later.
const API_RATE_LIMIT = 120; // requests
const API_RATE_WINDOW_SEC = 60; // per minute, per key

export type ApiAuthResult =
  | { ok: true; tenantId: string; keyId: string; scopes: string[]; tier: ApiKeyTier; environment: ApiKeyEnvironment }
  | { ok: false; response: NextResponse };

function bearerError(code: string, message: string, status: number, extra?: Record<string, string>) {
  const res = NextResponse.json(
    { ok: false, error: { code, message } },
    { status }
  );
  if (extra) for (const [k, v] of Object.entries(extra)) res.headers.set(k, v);
  return res;
}

/** Best-effort real usage log — never allowed to break the real API response. */
function logUsage(input: {
  tenantId: string | null;
  apiKeyId: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  outcome: string;
}) {
  db.apiUsageLog.create({ data: input }).catch(() => {});
}

export async function authenticateApiRequest(
  req: Request,
  requiredScope?: string
): Promise<ApiAuthResult> {
  const startedAt = Date.now();
  const method = (req as { method?: string }).method ?? "GET";
  const path = new URL(req.url).pathname;

  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    logUsage({ tenantId: null, apiKeyId: null, method, path, statusCode: 401, durationMs: Date.now() - startedAt, outcome: "UNAUTHENTICATED" });
    return {
      ok: false,
      response: bearerError(
        "UNAUTHENTICATED",
        "Missing Authorization: Bearer <token> header.",
        401,
        { "WWW-Authenticate": "Bearer" }
      ),
    };
  }

  const token = match[1].trim();
  const resolved = await resolveBearerToken(token);
  if (!resolved) {
    logUsage({ tenantId: null, apiKeyId: null, method, path, statusCode: 401, durationMs: Date.now() - startedAt, outcome: "INVALID_TOKEN" });
    return {
      ok: false,
      response: bearerError("INVALID_TOKEN", "API key is invalid, revoked, or expired.", 401),
    };
  }

  // Real NEYO Ops attribution always uses the OWNING school (not a
  // sandbox key's anonymous isolated tenant) — a real developer's usage
  // pattern should be visible to Ops regardless of which environment
  // they're calling against.
  const attributionTenantId = resolved.owningTenantId;

  // Per-key rate limit (A.16.3).
  const rate = checkRate(`apikey:${resolved.keyId}`, API_RATE_LIMIT, API_RATE_WINDOW_SEC);
  if (!rate.allowed) {
    logUsage({ tenantId: attributionTenantId, apiKeyId: resolved.keyId, method, path, statusCode: 429, durationMs: Date.now() - startedAt, outcome: "RATE_LIMITED" });
    return {
      ok: false,
      response: bearerError(
        "RATE_LIMITED",
        `Rate limit exceeded. Try again in ${rate.retryAfterSec}s.`,
        429,
        {
          "Retry-After": String(rate.retryAfterSec),
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": "0",
        }
      ),
    };
  }

  // Scope check (A.16.1 scopes).
  if (requiredScope && !scopeAllows(resolved.scopes, requiredScope)) {
    logUsage({ tenantId: attributionTenantId, apiKeyId: resolved.keyId, method, path, statusCode: 403, durationMs: Date.now() - startedAt, outcome: "INSUFFICIENT_SCOPE" });
    return {
      ok: false,
      response: bearerError(
        "INSUFFICIENT_SCOPE",
        `This API key lacks the required scope: ${requiredScope}.`,
        403
      ),
    };
  }

  logUsage({ tenantId: attributionTenantId, apiKeyId: resolved.keyId, method, path, statusCode: 200, durationMs: Date.now() - startedAt, outcome: "OK" });

  return {
    ok: true,
    tenantId: resolved.tenantId,
    keyId: resolved.keyId,
    scopes: resolved.scopes,
    tier: resolved.tier,
    environment: resolved.environment,
  };
}
