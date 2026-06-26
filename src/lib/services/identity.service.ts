/**
 * Identity generation service (Feature A.4).
 * - nextTenantId: atomic, race-safe per-(tenant, entityType) human ID.
 * - generateNeyoLoginId: a globally-unique NEYO platform login ID.
 *
 * Overhauled to use the new format (KHS5 instead of KH-S-000005) - no dashes
 * and no leading zeros.
 */
import crypto from "crypto";
import { db } from "@/lib/db";
import {
  prefixFromSlug,
  entityCode,
} from "@/lib/core/identity";

/**
 * Reserve the next number for (tenant, entityType) and format the tenant ID.
 * Returns e.g. "KHS5" (no dashes, no leading zeros).
 */
export async function nextTenantId(
  tenantId: string,
  entityType: string,
  opts?: { padding?: number }
): Promise<string> {
  const type = entityType.toUpperCase();

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  if (!tenant) throw new Error(`Tenant ${tenantId} not found.`);

  // Atomically reserve the next value with a single upsert+increment.
  const updated = await db.idSequence.upsert({
    where: { tenantId_entityType: { tenantId, entityType: type } },
    update: { lastValue: { increment: 1 } },
    create: { tenantId, entityType: type, lastValue: 1 },
  });
  const value = updated.lastValue;

  const prefix = prefixFromSlug(tenant.slug);
  const code = entityCode(type);
  const number = String(value);
  return `${prefix}${code}${number}`;
}

/**
 * Peek at the next number WITHOUT consuming it (for previews in forms).
 */
export async function peekNextTenantId(
  tenantId: string,
  entityType: string,
  opts?: { padding?: number }
): Promise<string> {
  const type = entityType.toUpperCase();
  const [tenant, seq] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } }),
    db.idSequence.findUnique({
      where: { tenantId_entityType: { tenantId, entityType: type } },
    }),
  ]);
  if (!tenant) throw new Error(`Tenant ${tenantId} not found.`);
  const next = (seq?.lastValue ?? 0) + 1;
  return `${prefixFromSlug(tenant.slug)}${entityCode(type)}${next}`;
}

/**
 * Globally-unique NEYO platform login ID (A.4.1, two-ID system).
 * Format: NEYO<base32-ish 10 chars> (no dashes).
 */
export async function generateNeyoLoginId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = crypto.randomBytes(7).toString("hex").slice(0, 10).toUpperCase();
    const candidate = `NEYO${rand}`;
    const clash = await db.user.findUnique({
      where: { neyoLoginId: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `NEYO${Date.now().toString(36).toUpperCase()}`;
}
