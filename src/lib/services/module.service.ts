/**
 * Per-tenant module toggling service (Feature A.2.6).
 * Reads the Tenant root + the tenant-owned TenantModule table.
 */
import { db } from "@/lib/db";
import { MODULES, getModuleDef, isModuleKey } from "@/lib/core/modules";

export class ModuleError extends Error {
  constructor(
    public reason: "UNKNOWN_MODULE" | "MODULE_LOCKED",
    message: string
  ) {
    super(message);
    this.name = "ModuleError";
  }
}

export interface ModuleState {
  key: string;
  label: string;
  description: string;
  href: string;
  core: boolean;
  enabled: boolean;
}

/**
 * Effective module states for a tenant: registry defaults merged with any
 * explicit overrides stored in TenantModule. Core modules are always enabled.
 */
export async function getModuleStates(tenantId: string): Promise<ModuleState[]> {
  const rows = await db.tenantModule.findMany({ where: { tenantId } });
  const overrides = new Map(rows.map((r) => [r.moduleKey, r.enabled]));
  // G.22: NEYO platform pause overrides EVERYTHING (even tenant-enabled).
  const { pausedModuleKeys } = await import("@/lib/services/platform-flags.service");
  const paused = await pausedModuleKeys();

  return MODULES.map((m) => ({
    key: m.key,
    label: m.label,
    description: m.description,
    href: m.href,
    core: m.core,
    enabled: paused.has(m.key)
      ? false // paused platform-wide while NEYO keeps building
      : m.core ? true : (overrides.get(m.key) ?? m.defaultOn),
  }));
}

/** Just the set of enabled module keys (used to filter the sidebar). */
export async function getEnabledModuleKeys(
  tenantId: string
): Promise<Set<string>> {
  const states = await getModuleStates(tenantId);
  return new Set(states.filter((s) => s.enabled).map((s) => s.key));
}

/** Enable/disable a module for a tenant. Core modules cannot be disabled. */
export async function setModule(
  tenantId: string,
  actor: { id: string; fullName: string },
  moduleKey: string,
  enabled: boolean
): Promise<ModuleState[]> {
  if (!isModuleKey(moduleKey)) {
    throw new ModuleError("UNKNOWN_MODULE", "That module does not exist.");
  }
  const def = getModuleDef(moduleKey)!;
  if (def.core && !enabled) {
    throw new ModuleError(
      "MODULE_LOCKED",
      `${def.label} is a core module and can't be turned off.`
    );
  }

  await db.$transaction([
    db.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
      update: { enabled },
      create: { tenantId, moduleKey, enabled },
    }),
    db.auditLog.create({
      data: {
        tenantId,
        actorId: actor.id,
        actorName: actor.fullName,
        action: enabled ? "module.enabled" : "module.disabled",
        entityType: "TenantModule",
        entityId: moduleKey,
      },
    }),
  ]);

  return getModuleStates(tenantId);
}

/** Seed a tenant's modules to registry defaults (idempotent). */
export async function initialiseModules(tenantId: string): Promise<void> {
  for (const m of MODULES) {
    if (m.core) continue; // core modules need no row
    await db.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: m.key } },
      update: {},
      create: { tenantId, moduleKey: m.key, enabled: m.defaultOn },
    });
  }
}
