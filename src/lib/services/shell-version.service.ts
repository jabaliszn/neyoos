import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import { SHELL_VERSIONS, type ShellVersion } from "@/lib/validations/shell-version";

/**
 * Shell Version (founder-requested "NEYO Shell V2", 2026-07-04) —
 * COMPANY-GLOBAL setting today, same PlatformSetting family as G.33's
 * `liquid_level` (platform-appearance.service.ts). Only NEYO (SUPER_ADMIN)
 * writes the platform default and controls the release gate below; every
 * signed-in client reads.
 *
 * Shell V1 = the original persistent left sidebar (untouched, still the
 * default, never at risk of being removed).
 * Shell V2 = the floating bottom module bar + left Activity/Intercom panel,
 * built to feel like WhatsApp's Updates/Calls/Chats bar but in NEYO's own
 * brand colors and with a real Liquid Glass finish.
 *
 * PHASE 2 (2026-07-05) — the founder's own phased roadmap, now built:
 * "for now neyo ops but later wen we launch it every one can change in
 * their setting and later it becomes companys default." Founder's own
 * answers when scoped: NEYO Ops configures the release via a real master
 * on/off switch PLUS a per-school early-access list (a real staged
 * rollout — same JSON-in-PlatformSetting shape already used by the J.23
 * Revenue Grants system, no new table needed); once released for a given
 * school, a staff member's personal choice starts by FOLLOWING the
 * platform/school default until they explicitly pick one for themselves.
 */
const SHELL_VERSION_KEY = "shell_version";
const SHELL_RELEASE_KEY = "shell_personal_toggle_released"; // "true" | "false"
const SHELL_EARLY_ACCESS_KEY = "shell_personal_toggle_early_access"; // JSON: string[] of tenantIds

export class ShellVersionError extends Error {
  constructor(public code: "INVALID" | "NOT_FOUND", message: string) {
    super(message);
    this.name = "ShellVersionError";
  }
}

/** The platform-wide default, set by NEYO Ops. Defaults to "v1" (today's
 * sidebar) so no school is ever silently switched to the new shell. */
export async function getPlatformShellVersion(): Promise<ShellVersion> {
  const row = await db.platformSetting.findUnique({ where: { key: SHELL_VERSION_KEY } });
  return row && (SHELL_VERSIONS as readonly string[]).includes(row.value)
    ? (row.value as ShellVersion)
    : "v1";
}

export async function setPlatformShellVersion(user: SessionUser, shellVersion: string): Promise<ShellVersion> {
  if (!(SHELL_VERSIONS as readonly string[]).includes(shellVersion)) {
    throw new ShellVersionError("INVALID", 'Shell version must be "v1" or "v2".');
  }
  await db.platformSetting.upsert({
    where: { key: SHELL_VERSION_KEY },
    create: { key: SHELL_VERSION_KEY, value: shellVersion, updatedBy: user.fullName },
    update: { value: shellVersion, updatedBy: user.fullName },
  });
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "platform.shell_version_updated",
      entityType: "PlatformSetting",
      entityId: SHELL_VERSION_KEY,
      metadata: JSON.stringify({ shellVersion }),
    },
  });
  return shellVersion as ShellVersion;
}

// ---------------------------------------------------------------------------
// Release gate — NEYO Ops "configure how they want it" (master + per-school).
// ---------------------------------------------------------------------------

/** Master switch: is the personal per-user toggle released AT ALL, anywhere? */
export async function isPersonalShellTogglePlatformReleased(): Promise<boolean> {
  const row = await db.platformSetting.findUnique({ where: { key: SHELL_RELEASE_KEY } });
  return row?.value === "true";
}

async function readEarlyAccessTenantIds(): Promise<Set<string>> {
  const row = await db.platformSetting.findUnique({ where: { key: SHELL_EARLY_ACCESS_KEY } });
  if (!row?.value) return new Set();
  try {
    const parsed = JSON.parse(row.value);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/** Is the personal toggle released for THIS specific school — either because
 * the master switch is fully on, or because this school has real staged
 * early access? */
export async function isPersonalShellToggleReleasedForTenant(tenantId: string): Promise<boolean> {
  if (await isPersonalShellTogglePlatformReleased()) return true;
  const earlyAccess = await readEarlyAccessTenantIds();
  return earlyAccess.has(tenantId);
}

/** SUPER_ADMIN: flip the real master on/off switch. */
export async function setPersonalShellTogglePlatformReleased(user: SessionUser, released: boolean): Promise<boolean> {
  await db.platformSetting.upsert({
    where: { key: SHELL_RELEASE_KEY },
    create: { key: SHELL_RELEASE_KEY, value: String(released), updatedBy: user.fullName },
    update: { value: String(released), updatedBy: user.fullName },
  });
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: released ? "platform.shell_personal_toggle_released" : "platform.shell_personal_toggle_unreleased",
      entityType: "PlatformSetting",
      entityId: SHELL_RELEASE_KEY,
      metadata: JSON.stringify({ released }),
    },
  });
  return released;
}

/** SUPER_ADMIN: grant/revoke ONE school real early access ahead of the
 * master switch — a genuine staged rollout, not an all-or-nothing flip. */
export async function setShellEarlyAccessForTenant(user: SessionUser, targetTenantId: string, earlyAccess: boolean): Promise<{ tenantId: string; earlyAccess: boolean }> {
  const tenant = await db.tenant.findUnique({ where: { id: targetTenantId }, select: { id: true, name: true } });
  if (!tenant) throw new ShellVersionError("NOT_FOUND", "Target school not found.");

  const current = await readEarlyAccessTenantIds();
  if (earlyAccess) current.add(targetTenantId);
  else current.delete(targetTenantId);

  await db.platformSetting.upsert({
    where: { key: SHELL_EARLY_ACCESS_KEY },
    create: { key: SHELL_EARLY_ACCESS_KEY, value: JSON.stringify(Array.from(current)), updatedBy: user.fullName },
    update: { value: JSON.stringify(Array.from(current)), updatedBy: user.fullName },
  });
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: earlyAccess ? "platform.shell_early_access_granted" : "platform.shell_early_access_revoked",
      entityType: "Tenant",
      entityId: targetTenantId,
      metadata: JSON.stringify({ targetSchool: tenant.name }),
    },
  });
  return { tenantId: targetTenantId, earlyAccess };
}

/** Full release-gate state, for the NEYO Ops console. */
export async function getShellReleaseState(): Promise<{ released: boolean; earlyAccessTenantIds: string[] }> {
  const [released, earlyAccess] = await Promise.all([
    isPersonalShellTogglePlatformReleased(),
    readEarlyAccessTenantIds(),
  ]);
  return { released, earlyAccessTenantIds: Array.from(earlyAccess) };
}

// ---------------------------------------------------------------------------
// Personal per-user override (only effective once released for the user's
// own school — see resolveShellVersion() below).
// ---------------------------------------------------------------------------

/** The user's own raw stored preference — null means "no personal choice
 * made, follow the default" (mirrors lgContrast's "company" option). */
export async function getPersonalShellVersion(user: SessionUser): Promise<ShellVersion | null> {
  const row = await db.user.findUnique({ where: { id: user.id }, select: { shellVersion: true } });
  const value = row?.shellVersion;
  return value && (SHELL_VERSIONS as readonly string[]).includes(value) ? (value as ShellVersion) : null;
}

/** Save (or clear, via null) the signed-in user's own personal shell choice.
 * Real-world honesty: this SAVES regardless of the release gate (a person
 * setting a preference for later is harmless), but `resolveShellVersion()`
 * below only ever HONORS it once the gate is open for their school —
 * exactly like a light switch wired to a breaker that isn't live yet. */
export async function setPersonalShellVersion(user: SessionUser, shellVersion: string | null): Promise<ShellVersion | null> {
  if (shellVersion !== null && !(SHELL_VERSIONS as readonly string[]).includes(shellVersion)) {
    throw new ShellVersionError("INVALID", 'Shell version must be "v1", "v2", or null (follow the default).');
  }
  await db.user.update({ where: { id: user.id }, data: { shellVersion } });
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "user.shell_version_updated",
      entityType: "User",
      entityId: user.id,
      metadata: JSON.stringify({ shellVersion }),
    },
  });
  return shellVersion as ShellVersion | null;
}

/**
 * The single real resolution point every page render should call.
 * Layering (personal wins only once genuinely released for this school):
 *   1. If the personal-toggle release gate is OPEN for this user's school
 *      (master switch OR real per-school early access) AND the user has
 *      made their own explicit choice -> use it.
 *   2. Otherwise -> the platform/company default (today's `getPlatformShellVersion()`;
 *      a future per-school Tenant-level override, once built, would slot in
 *      here too, ahead of the platform default and behind the personal one).
 */
export async function resolveShellVersion(user?: SessionUser): Promise<ShellVersion> {
  const platformDefault = await getPlatformShellVersion();
  if (!user) return platformDefault;

  const released = await isPersonalShellToggleReleasedForTenant(user.tenantId);
  if (!released) return platformDefault;

  const personal = await getPersonalShellVersion(user);
  return personal ?? platformDefault;
}
