/**
 * Bearer-token authentication for the Public API (A.16.2 + A.16.3).
 *
 * Usage in a /api/v1/* route:
 *   const auth = await authenticateApiRequest(req, "student.view");
 *   if (!auth.ok) return auth.response;
 *   await withTenant(auth.tenantId, async () => { ... });
 *
 * - Reads `Authorization: Bearer <token>`.
 * - Resolves the token to a tenant + scopes (A.16.2).
 * - Enforces a per-key sliding-window rate limit (A.16.3, reuses A.14).
 * - Optionally checks the key holds a required scope.
 */
import { NextResponse } from "next/server";
import { resolveBearerToken, scopeAllows } from "@/lib/services/api-key.service";
import { checkRate } from "@/lib/security/rate-limit";

// Generous default for server-to-server use; tune per plan later.
const API_RATE_LIMIT = 120; // requests
const API_RATE_WINDOW_SEC = 60; // per minute, per key

export type ApiAuthResult =
  | { ok: true; tenantId: string; keyId: string; scopes: string[] }
  | { ok: false; response: NextResponse };

function bearerError(code: string, message: string, status: number, extra?: Record<string, string>) {
  const res = NextResponse.json(
    { ok: false, error: { code, message } },
    { status }
  );
  if (extra) for (const [k, v] of Object.entries(extra)) res.headers.set(k, v);
  return res;
}

export async function authenticateApiRequest(
  req: Request,
  requiredScope?: string
): Promise<ApiAuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
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
    return {
      ok: false,
      response: bearerError("INVALID_TOKEN", "API key is invalid, revoked, or expired.", 401),
    };
  }

  // Per-key rate limit (A.16.3).
  const rate = checkRate(`apikey:${resolved.keyId}`, API_RATE_LIMIT, API_RATE_WINDOW_SEC);
  if (!rate.allowed) {
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
    return {
      ok: false,
      response: bearerError(
        "INSUFFICIENT_SCOPE",
        `This API key lacks the required scope: ${requiredScope}.`,
        403
      ),
    };
  }

  return {
    ok: true,
    tenantId: resolved.tenantId,
    keyId: resolved.keyId,
    scopes: resolved.scopes,
  };
}
