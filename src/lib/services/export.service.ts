/**
 * Tenant data export (Feature A.2.10 — right to portability, KE DPA / A.14).
 * Gathers ALL of a school's own data into a structured, human-readable JSON
 * bundle. Tenant-scoped via tenantDb. Secrets are REDACTED (exporting password
 * hashes / encryption keys / 2FA secrets would be a security hole, not export).
 *
 * As business modules land (students, fees, attendance...), add their slice
 * to `collectTenantData` so the export stays complete.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";

export const EXPORT_VERSION = "1.0";

export interface TenantExport {
  manifest: {
    exportVersion: string;
    generatedAt: string;
    tenant: { id: string; name: string; slug: string; county: string | null };
    recordCounts: Record<string, number>;
    note: string;
  };
  school: unknown;
  users: unknown[];
  modules: unknown[];
  auditLog: unknown[];
}

/** Build the full export bundle for a tenant. */
export async function exportTenantData(tenantId: string): Promise<TenantExport> {
  // Tenant root (not tenant-scoped) — fetch + redact crypto/key material.
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found.");

  return withTenant(tenantId, async () => {
    const tdb = tenantDb();

    // Users — redact secrets.
    const usersRaw = await tdb.user.findMany({ orderBy: { createdAt: "asc" } });
    const users = usersRaw.map((u) => ({
      neyoLoginId: u.neyoLoginId,
      fullName: u.fullName,
      phone: u.phone,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      twoFactorEnabled: u.totpEnabled,
      createdAt: u.createdAt,
      // REDACTED: passwordHash, totpSecret, credentials.
    }));

    const modules = await tdb.tenantModule.findMany({
      orderBy: { moduleKey: "asc" },
      select: { moduleKey: true, enabled: true, updatedAt: true },
    });

    const auditLog = await tdb.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000, // cap for a single-file export
      select: {
        action: true,
        actorName: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    });

    const school = {
      name: tenant.name,
      slug: tenant.slug,
      county: tenant.county,
      phone: tenant.phone,
      email: tenant.email,
      createdAt: tenant.createdAt,
      // REDACTED: encryptedDek, dekIv, dekTag (encryption key material).
    };

    return {
      manifest: {
        exportVersion: EXPORT_VERSION,
        generatedAt: new Date().toISOString(),
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          county: tenant.county,
        },
        recordCounts: {
          users: users.length,
          modules: modules.length,
          auditLog: auditLog.length,
        },
        note: "Credentials and encryption keys are intentionally excluded.",
      },
      school,
      users,
      modules,
      auditLog,
    };
  });
}

/** Audit that an export happened (who, when). */
export async function recordExportAudit(
  tenantId: string,
  actor: { id: string; fullName: string }
): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "tenant.data_exported",
      entityType: "Tenant",
      entityId: tenantId,
    },
  });
}
