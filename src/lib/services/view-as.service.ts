/**
 * In-school "View As" (Feature G.5).
 * A school leader previews the app as one of THEIR OWN staff, read-only.
 * Distinct from A.2.9 (NEYO super-admin cross-tenant impersonation).
 *
 * Rules:
 *  - Only SCHOOL_OWNER / PRINCIPAL / DEPUTY_PRINCIPAL may start it.
 *  - Target must be in the SAME tenant and not a leader/owner/super-admin.
 *  - Always read-only (viewAsReadOnly = true). Audit-logged in the tenant.
 */
import { db } from "@/lib/db";
import { AuthError } from "@/lib/core/session";

const LEADER_ROLES = ["SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL"];
const PROTECTED_TARGETS = ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL"];

export async function startViewAs(
  sessionToken: string,
  actor: { id: string; role: string; tenantId: string; fullName: string },
  targetUserId: string
): Promise<{ targetName: string; targetRole: string }> {
  if (!LEADER_ROLES.includes(actor.role)) {
    throw new AuthError(403, "Only school leadership can use View As.");
  }

  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target || !target.isActive) {
    throw new AuthError(403, "That staff member can't be previewed.");
  }
  if (target.tenantId !== actor.tenantId) {
    throw new AuthError(403, "You can only preview your own school's staff.");
  }
  if (PROTECTED_TARGETS.includes(target.role)) {
    throw new AuthError(403, "You can't preview as another leader.");
  }

  await db.$transaction([
    db.session.update({
      where: { token: sessionToken },
      data: { impersonatedUserId: targetUserId, viewAsReadOnly: true },
    }),
    db.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorId: actor.id,
        actorName: actor.fullName,
        action: "view_as.started",
        entityType: "User",
        entityId: target.id,
        metadata: JSON.stringify({ targetName: target.fullName, targetRole: target.role }),
      },
    }),
  ]);

  return { targetName: target.fullName, targetRole: target.role };
}

export async function stopViewAs(sessionToken: string): Promise<void> {
  const session = await db.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });
  if (!session || !session.impersonatedUserId) return;

  await db.$transaction([
    db.session.update({
      where: { token: sessionToken },
      data: { impersonatedUserId: null, viewAsReadOnly: false },
    }),
    db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorName: session.user.fullName,
        action: "view_as.stopped",
        entityType: "User",
      },
    }),
  ]);
}
