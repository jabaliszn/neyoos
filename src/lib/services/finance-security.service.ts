/**
 * R.3 — Finance biometric-gate setting (founder request 2026-07-03).
 *
 * A real, school-level toggle: when ON, recording a cash payment or applying
 * a fee discount/waiver requires a fresh, server-verified fingerprint/Face
 * ID/passkey check (WebAuthn — works with iPhone Face ID, Android
 * fingerprint sensors, Windows Hello, any platform authenticator; NOT tied
 * to any specific hardware). OFF by default so a school never gets locked
 * out of collecting fees before its staff have real passkeys registered.
 * Only leadership (PRINCIPAL/SCHOOL_OWNER/DEPUTY_PRINCIPAL, via
 * tenant.manage_settings) may change it.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export async function financeSecurityStatus(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tenant = await tenantDb().tenant.findUnique({ where: { id: user.tenantId }, select: { requireBiometricForFinance: true } });
    const hasOwnPasskey = (await db.credential.count({ where: { userId: user.id } })) > 0;
    return {
      requireBiometricForFinance: !!tenant?.requireBiometricForFinance,
      // Real, useful signal for the settings UI: warn the leader turning
      // this ON if THEY themselves don't have a passkey registered yet —
      // never a blocker for OTHER staff, since each user's own passkey
      // status is checked independently at the moment they act.
      currentUserHasPasskey: hasOwnPasskey,
    };
  });
}

export async function setFinanceSecurity(user: SessionUser, enabled: boolean) {
  return withTenant(user.tenantId, async () => {
    await tenantDb().tenant.update({ where: { id: user.tenantId }, data: { requireBiometricForFinance: enabled } });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "finance.biometric_gate_updated",
        entityType: "Tenant",
        entityId: user.tenantId,
        metadata: JSON.stringify({ enabled }),
      },
    });
    return { requireBiometricForFinance: enabled };
  });
}
