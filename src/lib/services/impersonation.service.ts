/**
 * Tenant impersonation for support (Feature A.2.9).
 * Only SUPER_ADMIN may impersonate. Every start/stop is audit-logged in the
 * TARGET tenant so schools have a record of any support access.
 */
import { db } from "@/lib/db";
import { AuthError } from "@/lib/core/session";

/** Begin impersonating a target user from an admin's session. */
export async function startImpersonation(
  sessionToken: string,
  adminUserId: string,
  targetUserId: string
): Promise<{ targetName: string; tenantName: string }> {
  const admin = await db.user.findUnique({ where: { id: adminUserId } });
  if (!admin || admin.role !== "SUPER_ADMIN") {
    throw new AuthError(403, "Only NEYO admins can impersonate.");
  }

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    include: { tenant: true },
  });
  if (!target || !target.isActive) {
    throw new AuthError(403, "That user cannot be impersonated.");
  }
  if (target.role === "SUPER_ADMIN") {
    throw new AuthError(403, "You cannot impersonate another NEYO admin.");
  }

  await db.$transaction([
    db.session.update({
      where: { token: sessionToken },
      data: { impersonatedUserId: targetUserId },
    }),
    db.auditLog.create({
      data: {
        tenantId: target.tenantId,
        actorId: admin.id,
        actorName: admin.fullName,
        action: "support.impersonation_started",
        entityType: "User",
        entityId: target.id,
        metadata: JSON.stringify({
          impersonatedName: target.fullName,
          impersonatedRole: target.role,
        }),
      },
    }),
  ]);

  return { targetName: target.fullName, tenantName: target.tenant.name };
}

/** Stop impersonating: clear the flag and audit it in the target tenant. */
export async function stopImpersonation(sessionToken: string): Promise<void> {
  const session = await db.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });
  if (!session || !session.impersonatedUserId) return;

  const target = await db.user.findUnique({
    where: { id: session.impersonatedUserId },
  });

  await db.$transaction([
    db.session.update({
      where: { token: sessionToken },
      data: { impersonatedUserId: null },
    }),
    ...(target
      ? [
          db.auditLog.create({
            data: {
              tenantId: target.tenantId,
              actorId: session.user.id,
              actorName: session.user.fullName,
              action: "support.impersonation_stopped",
              entityType: "User",
              entityId: target.id,
            },
          }),
        ]
      : []),
  ]);
}
