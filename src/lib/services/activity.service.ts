/**
 * Activity feed service (Feature G.1).
 * Reads the immutable AuditLog (A.14) to produce a per-entity timeline.
 * Tenant-scoped. Used by detail pages (Principle 8).
 */
import { db } from "@/lib/db";

export interface ActivityItem {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: Date;
  metadata: string | null;
}

/** Activity for a specific entity (e.g. a student), newest first. */
export async function entityActivity(
  tenantId: string,
  entityType: string,
  entityId: string,
  limit = 30
): Promise<ActivityItem[]> {
  const rows = await db.auditLog.findMany({
    where: { tenantId, entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, action: true, actorName: true, createdAt: true, metadata: true },
  });
  return rows;
}

/** Recent activity across the whole tenant (for dashboards). */
export async function tenantActivity(
  tenantId: string,
  limit = 30
): Promise<ActivityItem[]> {
  return db.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, action: true, actorName: true, createdAt: true, metadata: true },
  });
}

/** Human-friendly label for an audit action code. */
export function describeAction(action: string): string {
  const map: Record<string, string> = {
    "auth.login": "signed in",
    "auth.logout": "signed out",
    "auth.logout_everywhere": "signed out of all devices",
    "auth.2fa_enabled": "enabled two-factor",
    "auth.2fa_disabled": "disabled two-factor",
    "auth.passkey_registered": "added a passkey",
    "auth.passkey_removed": "removed a passkey",
    "module.enabled": "enabled a module",
    "module.disabled": "disabled a module",
    "tenant.data_exported": "exported school data",
    "billing.subscribed": "changed the plan",
    "payment.received": "received a payment",
    "payment.failed": "had a payment fail",
    "notification.sent": "sent a notification",
    "support.impersonation_started": "started a support session",
    "support.impersonation_stopped": "ended a support session",
  };
  return map[action] ?? action.replace(/[._]/g, " ");
}
