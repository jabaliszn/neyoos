/**
 * API Key service (A.16.1 generation/management + A.16.2 Bearer auth).
 *
 * Secret handling (security):
 *  - The full secret token is generated with crypto.randomBytes and shown to the
 *    user EXACTLY ONCE at creation. We never store it.
 *  - We persist only a SHA-256 hash (`keyHash`) for constant-time-ish lookup,
 *    plus a short non-secret prefix (`keyPrefix`) for display in the dashboard.
 *  - Bearer auth hashes the presented token and looks up the row by hash.
 *
 * Token format:  neyo_sk_<32 url-safe bytes>
 *   - "neyo_sk_" makes leaked keys greppable in logs/secret-scanners.
 *   - The first 12 chars (incl. prefix) are stored as keyPrefix for display.
 */
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { requireTenantId } from "@/lib/core/tenant-context";
import type { CreateApiKeyInput } from "@/lib/validations/api-keys";

export class ApiKeyError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID_TOKEN", message: string) {
    super(message);
    this.name = "ApiKeyError";
  }
}

const TOKEN_PREFIX = "neyo_sk_";

/** SHA-256 hex of the full token. Deterministic so we can look it up. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): { token: string; prefix: string } {
  // 32 random bytes -> 43-char url-safe base64 (no padding).
  const secret = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;
  // Display prefix = scheme + first 4 secret chars, e.g. "neyo_sk_3f9c".
  const prefix = `${TOKEN_PREFIX}${secret.slice(0, 4)}`;
  return { token, prefix };
}

/**
 * Create a new API key for the current tenant. Returns the PLAINTEXT token,
 * which the caller must show to the user once and then discard.
 */
export async function createApiKey(
  input: CreateApiKeyInput,
  createdById?: string
): Promise<{ id: string; token: string; keyPrefix: string }> {
  const { token, prefix } = generateToken();
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const row = await tenantDb().apiKey.create({
    // tenantId is auto-stamped by tenantDb() at runtime (A.2 isolation); the
    // cast keeps the type happy without us hard-coding the tenant here.
    data: {
      name: input.name,
      keyPrefix: prefix,
      keyHash: hashToken(token),
      scopes: JSON.stringify(input.scopes ?? ["*"]),
      expiresAt,
      createdById: createdById ?? null,
    } as never,
  });

  return { id: row.id, token, keyPrefix: prefix };
}

/** List the tenant's API keys (never returns the secret). */
export async function listApiKeys() {
  const rows = await tenantDb().apiKey.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: safeParse(k.scopes),
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    revokedAt: k.revokedAt,
    createdAt: k.createdAt,
    status: keyStatus(k.revokedAt, k.expiresAt),
  }));
}

export function keyStatus(
  revokedAt: Date | null,
  expiresAt: Date | null
): "active" | "revoked" | "expired" {
  if (revokedAt) return "revoked";
  if (expiresAt && expiresAt.getTime() < Date.now()) return "expired";
  return "active";
}

/** Revoke (soft-disable) a key. Idempotent. */
export async function revokeApiKey(id: string) {
  // tenantDb verifies the row belongs to the current tenant.
  const existing = await tenantDb().apiKey.findUnique({ where: { id } });
  if (!existing) throw new ApiKeyError("NOT_FOUND", "API key not found.");
  if (existing.revokedAt) return { id, revokedAt: existing.revokedAt };
  const updated = await tenantDb().apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return { id, revokedAt: updated.revokedAt };
}

/**
 * Bearer auth (A.16.2). Resolve a presented token to { tenantId, keyId, scopes }.
 * Returns null if the token is unknown, revoked, or expired. Runs WITHOUT a
 * tenant context (it discovers the tenant), so it uses the raw `db` client.
 */
export async function resolveBearerToken(token: string): Promise<{
  keyId: string;
  tenantId: string;
  scopes: string[];
} | null> {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const keyHash = hashToken(token);
  const key = await db.apiKey.findUnique({ where: { keyHash } });
  if (!key) return null;
  if (keyStatus(key.revokedAt, key.expiresAt) !== "active") return null;

  // Touch lastUsedAt (best-effort; don't block the request on it).
  db.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { keyId: key.id, tenantId: key.tenantId, scopes: safeParse(key.scopes) };
}

/** Does a key's scope set permit a given permission? "*" allows everything. */
export function scopeAllows(scopes: string[], permission: string): boolean {
  return scopes.includes("*") || scopes.includes(permission);
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Keep an explicit reference so linters know requireTenantId is available to
// callers that wrap these in withTenant(); tenantDb() relies on it internally.
export { requireTenantId };
