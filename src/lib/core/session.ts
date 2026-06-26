/**
 * Session + role helpers (Features A.1 + A.3).
 * - The login cookie name and reading logic live here.
 * - `getCurrentUser()` resolves the session token -> real User from the DB.
 * - `requireRole(...)` is the backend guard every protected feature will call.
 *
 * NOTE: these read the REAL Session table created in Chunk 1 — no mocks.
 * Upgraded to support dual roles for staff members holding 2 roles simultaneously.
 */
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { DEVICE_COOKIE, cleanDeviceId } from "@/lib/core/device-id";
import { isRole, type Role } from "@/lib/core/roles";
import { can, permissionsForRole, type Permission } from "@/lib/core/permissions";

export const SESSION_COOKIE = "neyo_session";
export const SESSION_TTL_DAYS = 14;

export interface SessionUser {
  id: string;
  tenantId: string;
  neyoLoginId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  role: Role;
  secondaryRole: Role | null;
  language: string;
}

/** Full session context, including impersonation (A.2.9). */

const SUPPORT_STAFF_AREA_PERMISSIONS: Record<string, Permission[]> = {
  KITCHEN: ["calendar.view", "cafeteria.view", "cafeteria.manage", "panic.raise"],
  CLINIC: ["calendar.view", "clinic.view", "clinic.manage", "panic.raise"],
  TRANSPORT: ["calendar.view", "transport.view", "panic.raise"],
  SECURITY: ["calendar.view", "security.view", "security.manage", "panic.raise"],
  GENERAL: ["calendar.view", "panic.raise"],
};

function mergeUnique(perms: Permission[]) { return Array.from(new Set(perms)).sort() as Permission[]; }

export async function effectivePermissionsForUser(user: SessionUser): Promise<Permission[]> {
  const base = mergeUnique([
    ...permissionsForRole(user.role),
    ...(user.secondaryRole ? permissionsForRole(user.secondaryRole) : []),
  ]);
  if (user.role !== "SUPPORT_STAFF" || user.secondaryRole) return base;
  const profile = await db.staffProfile.findFirst({ where: { tenantId: user.tenantId, userId: user.id }, select: { visibilityAreas: true } });
  if (!profile?.visibilityAreas) return base;
  let areas: string[] = [];
  try { areas = JSON.parse(profile.visibilityAreas); } catch { areas = []; }
  if (areas.length === 0) return base;
  const allowed = mergeUnique(areas.flatMap((a) => SUPPORT_STAFF_AREA_PERMISSIONS[a] ?? []));
  return allowed;
}

export interface SessionContext {
  /** The EFFECTIVE user (the impersonated one, if impersonating). */
  user: SessionUser;
  /** True when a super-admin is acting as someone else. */
  isImpersonating: boolean;
  /** The real admin behind the impersonation (only set when impersonating). */
  realUser: SessionUser | null;
  /** True for an in-school read-only "View As" (G.5): all mutations blocked. */
  viewAsReadOnly: boolean;
  /** The session token (for stop-impersonation). */
  token: string;
  /** G.34 Security Hardening: True when 2FA is enforced but user hasn't set it up. */
  twoFactorEnforcedMissing?: boolean;
}

/**
 * Permissions that mutate data. While in read-only "View As" (G.5) these are
 * denied so a previewer can't accidentally change anything.
 */
const WRITE_PERMISSIONS = new Set<Permission>([
  "student.create",
  "student.edit",
  "student.delete",
  "class.manage",
  "attendance.record",
  "academics.manage",
  "exam.manage",
  "exam.enter_marks",
  "exam.publish",
  "finance.create_invoice",
  "finance.record_payment",
  "finance.manage_structure",
  "staff.manage",
  "comms.send",
  "tenant.manage_modules",
  "tenant.export_data",
  "tenant.manage_settings",
  "user.manage_roles",
  "api.manage",
  "calendar.manage",
  "reception.operate",
]);

function toSessionUser(u: {
  id: string;
  tenantId: string;
  neyoLoginId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  role: string;
  secondaryRole?: string | null;
  language?: string;
}): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    neyoLoginId: u.neyoLoginId,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: isRole(u.role) ? u.role : ("STUDENT" as Role),
    secondaryRole: u.secondaryRole && isRole(u.secondaryRole) ? u.secondaryRole : null,
    language: u.language ?? "en",
  };
}

/**
 * Resolve the full session context from the cookie, or null.
 * When the session is impersonating, `user` is the IMPERSONATED user (so all
 * tenant-scoped code acts as that school) and `realUser` is the admin.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.user || !session.user.isActive) return null;

  // Device Lock / ID Verification (I.39).
  // Every newly-created browser session is bound to a physical browser/device ID at login.
  // A stolen session cookie without the matching device cookie is rejected.
  const clientDeviceId = cleanDeviceId(cookies().get(DEVICE_COOKIE)?.value);
  if (session.deviceId) {
    if (!clientDeviceId || session.deviceId !== clientDeviceId) {
      console.warn(`[SECURITY LOCK] Foreign device blocked for user ${session.userId}. Session: ${session.id}`);
      return null;
    }
  } else if (clientDeviceId) {
    // Backward compatibility for old sessions created before I.39 hardening.
    await db.session.update({
      where: { id: session.id },
      data: { deviceId: clientDeviceId },
    });
    session.deviceId = clientDeviceId;
  } else {
    console.warn(`[SECURITY LOCK] Session has no trusted device binding for user ${session.userId}.`);
    return null;
  }

  const realUser = toSessionUser(session.user);

  // G.34 Security Hardening: Check if tenant enforces 2FA for staff/leaders
  const tenant = await db.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { enforce2Fa: true },
  });

  const targetUser = session.impersonatedUserId
    ? await db.user.findUnique({ where: { id: session.impersonatedUserId } })
    : session.user;

  const effectiveUser = targetUser ? toSessionUser(targetUser) : realUser;
  const isStaff = !["PARENT", "STUDENT"].includes(effectiveUser.role);
  const twoFactorEnforcedMissing = !!tenant?.enforce2Fa && isStaff && !targetUser?.totpEnabled;

  // Not impersonating: effective user IS the real user.
  if (!session.impersonatedUserId) {
    return {
      user: realUser,
      isImpersonating: false,
      realUser: null,
      viewAsReadOnly: false,
      token,
      twoFactorEnforcedMissing,
    };
  }

  // Impersonating / View-As: load the target. If gone/inactive, fall back.
  const target = await db.user.findUnique({
    where: { id: session.impersonatedUserId },
  });
  if (!target || !target.isActive) {
    return {
      user: realUser,
      isImpersonating: false,
      realUser: null,
      viewAsReadOnly: false,
      token,
      twoFactorEnforcedMissing,
    };
  }

  return {
    user: toSessionUser(target),
    isImpersonating: true,
    realUser,
    viewAsReadOnly: session.viewAsReadOnly,
    token,
    twoFactorEnforcedMissing,
  };
}

/**
 * Resolve the EFFECTIVE logged-in user (impersonated user if impersonating),
 * or null. Existing callers keep working unchanged.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const ctx = await getSessionContext();
  return ctx?.user ?? null;
}

/** Throwable error used by API routes to return a 401/403 cleanly. */
export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Backend guard: require a logged-in user (any role). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "You must be signed in.");
  return user;
}

/** Backend guard: require one of the allowed roles (A.3 enforcement). */
export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  const hasPrimary = allowed.includes(user.role);
  const hasSecondary = user.secondaryRole ? allowed.includes(user.secondaryRole) : false;
  if (allowed.length > 0 && !hasPrimary && !hasSecondary) {
    throw new AuthError(403, "You do not have permission to do this.");
  }
  return user;
}

/**
 * Backend guard: require ALL of the given fine-grained permissions (A.3.2).
 * Prefer this over requireRole for feature gating — it reads the permission
 * matrix, so authorization stays declarative and centralized.
 */
export async function requirePermission(
  ...needed: Permission[]
): Promise<SessionUser> {
  const ctx = await getSessionContext();
  if (!ctx) throw new AuthError(401, "You must be signed in.");

  // G.5: in read-only "View As", block any write permission.
  if (ctx.viewAsReadOnly && needed.some((p) => WRITE_PERMISSIONS.has(p))) {
    throw new AuthError(403, "You're previewing in read-only mode.");
  }

  const effective = await effectivePermissionsForUser(ctx.user);
  const missing = needed.filter((p) => !effective.includes(p));

  if (missing.length > 0) {
    throw new AuthError(403, "You do not have permission to do this.");
  }
  return ctx.user;
}
