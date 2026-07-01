/**
 * G.22 Platform feature flags (founder 2026-06-12: "US THE COMPANY SHOULD
 * HAVE A FEATURE WHERE WE CAN PAUSE SOMETHING AS WE STILL CONTINUE BUILDING
 * IT BEFORE RELEASING TO THE PUBLIC").
 *
 * SUPER_ADMIN (NEYO company) pauses a module key GLOBALLY: it vanishes from
 * every school's nav + its page/API returns "coming soon" — while we keep
 * building. NOT tenant-owned; lives at the platform level.
 */
import { db } from "@/lib/db";
import { MODULES, isModuleKey } from "@/lib/core/modules";
import { NAVIGATION } from "@/lib/core/navigation";
import { J_FEATURES, jFeatureKey, isJFeatureKey, J_FEATURE_PREFIX } from "@/lib/core/j-features";
import type { SessionUser } from "@/lib/core/session";

export class FlagError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "FlagError";
  }
}

/** Module keys currently paused platform-wide. Cheap query — called per layout render. */
export async function pausedModuleKeys(): Promise<Set<string>> {
  const rows = await db.platformFlag.findMany({ where: { paused: true } });
  return new Set(rows.map((r) => r.moduleKey).filter((k) => !k.startsWith("feature:")));
}

/** Feature hrefs currently paused platform-wide (nav-level launch staging). */
export async function pausedFeatureHrefs(): Promise<Set<string>> {
  const rows = await db.platformFlag.findMany({ where: { paused: true } });
  return new Set(rows.map((r) => r.moduleKey).filter((k) => k.startsWith("feature:")).map((k) => k.slice("feature:".length)));
}

/** Is one module paused? (For API guards.) */
export async function isPaused(moduleKey: string): Promise<{ paused: boolean; note: string | null }> {
  const row = await db.platformFlag.findUnique({ where: { moduleKey } });
  return { paused: Boolean(row?.paused), note: row?.note ?? null };
}

/** All module + navigation feature flags for the SUPER_ADMIN NEYO Ops console. */
export async function listFlags() {
  const rows = await db.platformFlag.findMany();
  const map = new Map(rows.map((r) => [r.moduleKey, r]));
  const moduleFlags = MODULES.filter((m) => !m.core).map((m) => ({
    moduleKey: m.key,
    label: m.label,
    kind: "module" as const,
    href: m.href,
    paused: map.get(m.key)?.paused ?? false,
    note: map.get(m.key)?.note ?? null,
  }));
  const seen = new Set<string>();
  const featureFlags = NAVIGATION.flatMap((section) => section.items).filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return item.href !== "/dashboard" && item.href !== "/settings/security";
  }).map((item) => {
    const key = `feature:${item.href}`;
    return {
      moduleKey: key,
      label: item.label,
      kind: "feature" as const,
      href: item.href,
      paused: map.get(key)?.paused ?? false,
      note: map.get(key)?.note ?? null,
    };
  });
  return [...moduleFlags, ...featureFlags].sort((a, b) => (a.kind === b.kind ? a.label.localeCompare(b.label) : a.kind.localeCompare(b.kind)));
}

/** Pause/release a module platform-wide. SUPER_ADMIN only (route-gated). */
export async function setFlag(user: SessionUser, moduleKey: string, paused: boolean, note?: string) {
  const isFeatureKey = moduleKey.startsWith("feature:") && NAVIGATION.some((s) => s.items.some((i) => `feature:${i.href}` === moduleKey));
  const isJFeature = isJFeatureKey(moduleKey);
  if (!isModuleKey(moduleKey) && !isFeatureKey && !isJFeature) throw new FlagError("NOT_FOUND", "Unknown module or feature key.");
  const row = await db.platformFlag.upsert({
    where: { moduleKey },
    create: { moduleKey, paused, note: note ?? null, updatedBy: user.fullName },
    update: { paused, note: note ?? null, updatedBy: user.fullName },
  });
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action: paused
        ? (isJFeature ? "platform.jfeature_paused" : isFeatureKey ? "platform.feature_paused" : "platform.module_paused")
        : (isJFeature ? "platform.jfeature_released" : isFeatureKey ? "platform.feature_released" : "platform.module_released"),
      entityType: "platformFlag", entityId: row.id,
      metadata: JSON.stringify({ moduleKey, note }),
    },
  });
  return row;
}

// =============================================================================
// Part-J feature toggles (founder 2026-06-29). Default ON (not paused).
// =============================================================================

/** All Part-J feature toggles for the NEYO Ops console (ON = not paused). */
export async function listJFeatureFlags() {
  const rows = await db.platformFlag.findMany({ where: { moduleKey: { startsWith: J_FEATURE_PREFIX } } });
  const map = new Map(rows.map((r) => [r.moduleKey, r]));
  return J_FEATURES.map((f) => {
    const key = jFeatureKey(f.id);
    const row = map.get(key);
    return {
      id: f.id,
      moduleKey: key,
      label: f.label,
      description: f.description,
      // ON = enabled = not paused. Defaults to ON when no flag row exists.
      enabled: !(row?.paused ?? false),
      note: row?.note ?? null,
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

/** Is a given Part-J feature currently switched OFF (paused)? Default: ON. */
export async function isJFeaturePaused(featureId: string): Promise<boolean> {
  const row = await db.platformFlag.findUnique({ where: { moduleKey: jFeatureKey(featureId) } });
  return Boolean(row?.paused);
}

/** Throw a typed error if a Part-J feature is switched off — used by API guards. */
export async function assertJFeatureEnabled(featureId: string) {
  if (await isJFeaturePaused(featureId)) {
    throw new FlagError("FORBIDDEN", "This feature is currently switched off by NEYO Ops. Please check back soon.");
  }
}
