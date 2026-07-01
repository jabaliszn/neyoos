/**
 * J.23 — Per-school manual feature grants (NEYO Ops override).
 *
 * Founder requirement (2026-06-29): NEYO Ops can manually grant a premium feature
 * to a specific school for free (a comp / pilot / VIP), regardless of their plan.
 *
 * Stored as a single JSON blob in `platformSetting` (key `neyo_feature_grants`),
 * shape: { [tenantId: string]: string[] } — the array is feature/add-on keys.
 * No schema migration required (consistent with how the pricing catalog is stored).
 */
import { db } from "@/lib/db";
import { REVENUE_FEATURE_KEYS } from "@/lib/core/revenue-features";

export const FEATURE_GRANTS_SETTING_KEY = "neyo_feature_grants";

export class FeatureGrantError extends Error {
  code: "INVALID" | "NOT_FOUND";
  constructor(code: "INVALID" | "NOT_FOUND", message: string) {
    super(message);
    this.name = "FeatureGrantError";
    this.code = code;
  }
}

type GrantMap = Record<string, string[]>;

async function readGrants(): Promise<GrantMap> {
  const setting = await db.platformSetting.findUnique({ where: { key: FEATURE_GRANTS_SETTING_KEY } });
  if (!setting?.value) return {};
  try {
    const parsed = JSON.parse(setting.value);
    return parsed && typeof parsed === "object" ? (parsed as GrantMap) : {};
  } catch {
    return {};
  }
}

async function writeGrants(map: GrantMap, actor: { fullName: string }): Promise<void> {
  await db.platformSetting.upsert({
    where: { key: FEATURE_GRANTS_SETTING_KEY },
    create: { key: FEATURE_GRANTS_SETTING_KEY, value: JSON.stringify(map), updatedBy: actor.fullName },
    update: { value: JSON.stringify(map), updatedBy: actor.fullName },
  });
}

/** The feature keys manually granted to a tenant (may be empty). */
export async function getGrantedFeatures(tenantId: string): Promise<string[]> {
  const map = await readGrants();
  return Array.isArray(map[tenantId]) ? map[tenantId] : [];
}

/** True if this tenant has a manual grant for the feature key. */
export async function hasFeatureGrant(tenantId: string, featureKey: string): Promise<boolean> {
  const granted = await getGrantedFeatures(tenantId);
  return granted.includes(featureKey);
}

/**
 * NEYO Ops: grant or revoke a premium feature for a specific school.
 * Audited. Validates the feature key + that the tenant exists.
 */
export async function setFeatureGrant(
  actor: { id: string; fullName: string; tenantId: string },
  targetTenantId: string,
  featureKey: string,
  granted: boolean,
  note?: string,
): Promise<{ tenantId: string; featureKey: string; granted: boolean }> {
  if (!REVENUE_FEATURE_KEYS.includes(featureKey)) {
    throw new FeatureGrantError("INVALID", `Unknown revenue feature key: ${featureKey}`);
  }
  const tenant = await db.tenant.findUnique({ where: { id: targetTenantId }, select: { id: true, name: true } });
  if (!tenant) throw new FeatureGrantError("NOT_FOUND", "Target school (tenant) not found.");

  const map = await readGrants();
  const current = new Set(Array.isArray(map[targetTenantId]) ? map[targetTenantId] : []);
  if (granted) current.add(featureKey);
  else current.delete(featureKey);

  if (current.size > 0) map[targetTenantId] = Array.from(current);
  else delete map[targetTenantId];

  await writeGrants(map, actor);

  try {
    await db.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorId: actor.id,
        actorName: actor.fullName,
        action: granted ? "platform.feature_grant_added" : "platform.feature_grant_removed",
        entityType: "Tenant",
        entityId: targetTenantId,
        metadata: JSON.stringify({ featureKey, targetSchool: tenant.name, note: note ?? null }),
      },
    });
  } catch {}

  return { tenantId: targetTenantId, featureKey, granted };
}

/** Full grant map (for the Ops UI). */
export async function listAllGrants(): Promise<GrantMap> {
  return readGrants();
}
