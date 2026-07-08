/**
 * API Key service (A.16.1 generation/management + A.16.2 Bearer auth),
 * extended by Part X — Developer Center 2.0 (founder-requested 2026-07-06)
 * with a real key TIER (a school's own SCHOOL key vs. a NEYO-issued
 * NEYO_PARTNER key for NEYO's own future first-party accessories — the
 * SAME real auth/rate-limit/scope mechanism, just a more privileged,
 * explicitly NEYO-vetted tier, per the founder's own confirmed answer)
 * and a real sandbox/live ENVIRONMENT distinction.
 *
 * Secret handling (security):
 *  - The full secret token is generated with crypto.randomBytes and shown to the
 *    user EXACTLY ONCE at creation. We never store it.
 *  - We persist only a SHA-256 hash (`keyHash`) for constant-time-ish lookup,
 *    plus a short non-secret prefix (`keyPrefix`) for display in the dashboard.
 *  - Bearer auth hashes the presented token and looks up the row by hash.
 *
 * Token format:
 *   neyo_sk_<32 url-safe bytes>       — a school's own SCHOOL-tier key
 *   neyo_sandbox_<32 url-safe bytes>  — a SCHOOL-tier sandbox key
 *   neyo_partner_<32 url-safe bytes>  — a NEYO_PARTNER-tier key
 *   - Every prefix is greppable in logs/secret-scanners, and the prefix
 *     alone already signals which real environment/tier a leaked key is,
 *     without needing a DB lookup to know how seriously to treat a leak.
 */
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { requireTenantId } from "@/lib/core/tenant-context";
import type { CreateApiKeyInput, ApiKeyTier, ApiKeyEnvironment } from "@/lib/validations/api-keys";

export class ApiKeyError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID_TOKEN", message: string) {
    super(message);
    this.name = "ApiKeyError";
  }
}

const LIVE_PREFIX = "neyo_sk_";
const SANDBOX_PREFIX = "neyo_sandbox_";
const PARTNER_PREFIX = "neyo_partner_";
const ALL_PREFIXES = [LIVE_PREFIX, SANDBOX_PREFIX, PARTNER_PREFIX];

/** SHA-256 hex of the full token. Deterministic so we can look it up. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function prefixFor(tier: ApiKeyTier, environment: ApiKeyEnvironment): string {
  if (tier === "NEYO_PARTNER") return PARTNER_PREFIX;
  return environment === "sandbox" ? SANDBOX_PREFIX : LIVE_PREFIX;
}

function generateToken(tier: ApiKeyTier, environment: ApiKeyEnvironment): { token: string; prefix: string } {
  const scheme = prefixFor(tier, environment);
  // 32 random bytes -> 43-char url-safe base64 (no padding).
  const secret = randomBytes(32).toString("base64url");
  const token = `${scheme}${secret}`;
  const prefix = `${scheme}${secret.slice(0, 4)}`;
  return { token, prefix };
}

/**
 * Create a new SCHOOL-tier API key for the current tenant (self-service,
 * from Settings → Developer). Returns the PLAINTEXT token, which the
 * caller must show to the user once and then discard.
 *
 * A "sandbox" key (founder's own "Sandbox" ask) is real, honest isolation
 * — it does NOT read/write this school's own live data. Instead it is
 * automatically bound to a fresh, real, isolated demo-style tenant
 * (reusing G.14's own proven `createDemoSchool()` seed), so a developer
 * can build and test against real, realistic data without ever touching a
 * real family's real records. A school's real, live requests always use a
 * "live" key against their OWN real tenant, exactly as today.
 */
export async function createApiKey(
  input: CreateApiKeyInput,
  createdById?: string
): Promise<{ id: string; token: string; keyPrefix: string; environment: ApiKeyEnvironment }> {
  const environment = input.environment ?? "live";
  const { token, prefix } = generateToken("SCHOOL", environment);
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  let sandboxTenantId: string | null = null;
  if (environment === "sandbox") {
    // A real sandbox key needs a real, long-lived demo tenant — NOT the
    // real 24h G.14 visitor-demo TTL (which would silently delete the
    // developer's sandbox mid-integration-build). 90 real days, refreshed
    // automatically every time the sandbox key is actually used (see
    // `resolveBearerToken()`), so an actively-developed integration never
    // expires, while a genuinely abandoned sandbox is still real-purged
    // eventually by the same existing `demo-purge` cron.
    const { createDemoSchool, SANDBOX_TTL_HOURS } = await import("@/lib/services/demo.service");
    const sandbox = await createDemoSchool(undefined, SANDBOX_TTL_HOURS);
    sandboxTenantId = sandbox.tenantId;
  }

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
      tier: "SCHOOL",
      environment,
      sandboxTenantId,
    } as never,
  });

  return { id: row.id, token, keyPrefix: prefix, environment };
}

/**
 * NEYO Ops-only (SUPER_ADMIN), for NEYO's own future first-party
 * accessories connecting to a specific real school's tenant (Part X, the
 * founder's own "ready for NEYO to connect its accessories" request).
 * A NEYO_PARTNER key is always "live" — a partner accessory has no real
 * concept of a sandbox environment of its own.
 */
export async function createPartnerApiKey(
  tenantId: string,
  input: { name: string; scopes: string[]; expiresInDays?: number },
  createdById: string
): Promise<{ id: string; token: string; keyPrefix: string }> {
  const { token, prefix } = generateToken("NEYO_PARTNER", "live");
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const row = await db.apiKey.create({
    data: {
      tenantId,
      name: input.name,
      keyPrefix: prefix,
      keyHash: hashToken(token),
      scopes: JSON.stringify(input.scopes),
      expiresAt,
      createdById,
      tier: "NEYO_PARTNER",
      environment: "live",
    },
  });

  return { id: row.id, token, keyPrefix: prefix };
}

/** List the tenant's own SCHOOL-tier API keys (never returns the secret).
 * A school's own Developer settings page only ever sees its own SCHOOL
 * keys — a NEYO_PARTNER key for that same school is managed exclusively
 * from NEYO Ops, never self-service. */
export async function listApiKeys() {
  const rows = await tenantDb().apiKey.findMany({
    where: { tier: "SCHOOL" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(publicKeyRow);
}

/** NEYO Ops — list every real NEYO_PARTNER key across every school. */
export async function listPartnerApiKeys() {
  const rows = await db.apiKey.findMany({
    where: { tier: "NEYO_PARTNER" },
    orderBy: { createdAt: "desc" },
    include: { tenant: { select: { name: true } } },
  });
  return rows.map((k) => ({ ...publicKeyRow(k), tenantName: k.tenant.name }));
}

function publicKeyRow(k: {
  id: string; name: string; keyPrefix: string; scopes: string;
  lastUsedAt: Date | null; expiresAt: Date | null; revokedAt: Date | null;
  createdAt: Date; tier: string; environment: string;
}) {
  return {
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: safeParse(k.scopes),
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    revokedAt: k.revokedAt,
    createdAt: k.createdAt,
    tier: k.tier,
    environment: k.environment,
    status: keyStatus(k.revokedAt, k.expiresAt),
  };
}

export function keyStatus(
  revokedAt: Date | null,
  expiresAt: Date | null
): "active" | "revoked" | "expired" {
  if (revokedAt) return "revoked";
  if (expiresAt && expiresAt.getTime() < Date.now()) return "expired";
  return "active";
}

/** Revoke (soft-disable) a key. Idempotent. Only ever a SCHOOL-tier key
 * revoked from a school's own tenant-scoped session. */
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

/** NEYO Ops — revoke ANY key by id (SCHOOL or NEYO_PARTNER), across any
 * tenant. Used for real security-incident response. */
export async function revokeApiKeyAsOps(id: string) {
  const existing = await db.apiKey.findUnique({ where: { id } });
  if (!existing) throw new ApiKeyError("NOT_FOUND", "API key not found.");
  if (existing.revokedAt) return { id, revokedAt: existing.revokedAt };
  const updated = await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  return { id, revokedAt: updated.revokedAt };
}

/**
 * Bearer auth (A.16.2). Resolve a presented token to
 * { tenantId, keyId, scopes, tier, environment }. Returns null if the
 * token is unknown, revoked, or expired. Runs WITHOUT a tenant context (it
 * discovers the tenant), so it uses the raw `db` client.
 */
export async function resolveBearerToken(token: string): Promise<{
  keyId: string;
  tenantId: string; // the REAL EFFECTIVE tenant this key operates against — for a sandbox key, this is the isolated sandbox tenant, NEVER the owning school's live data
  owningTenantId: string; // the school that actually owns/manages this key (for real Ops attribution/listing)
  scopes: string[];
  tier: ApiKeyTier;
  environment: ApiKeyEnvironment;
} | null> {
  if (!token || !ALL_PREFIXES.some((p) => token.startsWith(p))) return null;
  const keyHash = hashToken(token);
  const key = await db.apiKey.findUnique({ where: { keyHash } });
  if (!key) return null;
  if (keyStatus(key.revokedAt, key.expiresAt) !== "active") return null;

  // Touch lastUsedAt (best-effort; don't block the request on it).
  db.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  // A real sandbox key's requests genuinely operate against its own
  // isolated sandbox tenant — never the owning school's live data. Real,
  // honest isolation, per the founder's own "Sandbox" ask. Actively using
  // a sandbox key also refreshes its real tenant's expiry, so an
  // actively-developed integration never expires mid-build.
  let effectiveTenantId = key.tenantId;
  if (key.environment === "sandbox" && key.sandboxTenantId) {
    effectiveTenantId = key.sandboxTenantId;
    const { SANDBOX_TTL_HOURS } = await import("@/lib/services/demo.service");
    db.tenant
      .update({ where: { id: key.sandboxTenantId }, data: { demoExpiresAt: new Date(Date.now() + SANDBOX_TTL_HOURS * 3600_000) } })
      .catch(() => {});
  }

  return {
    keyId: key.id,
    tenantId: effectiveTenantId,
    owningTenantId: key.tenantId,
    scopes: safeParse(key.scopes),
    tier: key.tier as ApiKeyTier,
    environment: key.environment as ApiKeyEnvironment,
  };
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
