import { z } from "zod";
import { db } from "@/lib/db";
import { saveCompanySecret, secretStatus } from "@/lib/services/company-secret.service";

const CONFIG_KEY = "google_workspace_storage_config";
const PRIVATE_KEY_SECRET = "google_workspace_storage_private_key";

export const googleWorkspaceStorageConfigSchema = z.object({
  storageDomain: z.string().trim().min(3).max(120),
  adminEmail: z.string().trim().email(),
  customerId: z.string().trim().max(80).optional().or(z.literal("")),
  serviceAccountClientEmail: z.string().trim().email(),
  privateKey: z.string().trim().min(10).optional().or(z.literal("")),
  defaultStorageGb: z.coerce.number().int().min(1).max(100_000).default(15),
  legalConsent: z.boolean().default(false),
});

export async function getGoogleWorkspaceStorageConfig() {
  const setting = await db.platformSetting.findUnique({ where: { key: CONFIG_KEY } });
  let config: any = {
    storageDomain: "storage.neyo.co.ke",
    adminEmail: "",
    customerId: "",
    serviceAccountClientEmail: "",
    defaultStorageGb: 15,
    legalConsent: false,
    configured: false,
  };
  if (setting?.value) {
    try { config = { ...config, ...JSON.parse(setting.value) }; } catch {}
  }
  const secret = await secretStatus(PRIVATE_KEY_SECRET);
  return { ...config, privateKeyStored: Boolean(secret), privateKeyMasked: secret?.masked || null, privateKeyUpdatedAt: secret?.updatedAt || null };
}

export async function saveGoogleWorkspaceStorageConfig(actor: { id: string; fullName: string; tenantId: string }, input: z.infer<typeof googleWorkspaceStorageConfigSchema>) {
  const data = googleWorkspaceStorageConfigSchema.parse(input);
  const safeConfig = {
    storageDomain: data.storageDomain,
    adminEmail: data.adminEmail,
    customerId: data.customerId || "",
    serviceAccountClientEmail: data.serviceAccountClientEmail,
    defaultStorageGb: data.defaultStorageGb,
    legalConsent: data.legalConsent,
    configured: true,
  };
  const setting = await db.platformSetting.upsert({ where: { key: CONFIG_KEY }, create: { key: CONFIG_KEY, value: JSON.stringify(safeConfig), updatedBy: actor.fullName }, update: { value: JSON.stringify(safeConfig), updatedBy: actor.fullName } });
  if (data.privateKey) {
    await saveCompanySecret({ key: PRIVATE_KEY_SECRET, provider: "GOOGLE_WORKSPACE", label: "Google Workspace storage service-account private key", value: data.privateKey, updatedBy: actor.fullName });
  }
  await db.auditLog.create({ data: { tenantId: actor.tenantId, actorId: actor.id, actorName: actor.fullName, action: "platform.google_workspace_storage_configured", entityType: "PlatformSetting", entityId: setting.key, metadata: JSON.stringify({ storageDomain: data.storageDomain, adminEmail: data.adminEmail, serviceAccountClientEmail: data.serviceAccountClientEmail, defaultStorageGb: data.defaultStorageGb, legalConsent: data.legalConsent, privateKeyStored: Boolean(data.privateKey) }) } });
  return getGoogleWorkspaceStorageConfig();
}

function slugStorageEmail(slug: string, domain: string) {
  const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${clean}.storage@${domain}`;
}

export async function provisionGoogleWorkspaceVault(actor: { id: string; fullName: string; tenantId: string }, tenantId: string) {
  const config = await getGoogleWorkspaceStorageConfig();
  if (!config.configured || !config.legalConsent) throw new Error("Google Workspace storage is not configured with legal consent in NEYO Ops.");
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, slug: true, name: true } });
  if (!tenant) throw new Error("School tenant not found.");
  const accountEmail = slugStorageEmail(tenant.slug, config.storageDomain);
  const storageLimitBytes = BigInt(config.defaultStorageGb) * BigInt(1024 ** 3);
  const row = await db.tenantStorageProvider.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, provider: "GOOGLE_WORKSPACE_MANAGED", status: "READY_TO_CONNECT", accountEmail, storageLimitBytes, storageUsedBytes: BigInt(0), healthStatus: "WARNING", encryptionMode: "AES_256_GCM_ENVELOPE", notes: "Google Workspace Admin SDK provisioning seam prepared in NEYO Ops. Live user creation activates when Google credentials are enabled." },
    update: { provider: "GOOGLE_WORKSPACE_MANAGED", status: "READY_TO_CONNECT", accountEmail, storageLimitBytes, healthStatus: "WARNING", encryptionMode: "AES_256_GCM_ENVELOPE", notes: "Google Workspace Admin SDK provisioning seam prepared in NEYO Ops. Live user creation activates when Google credentials are enabled." },
  });
  await db.auditLog.create({ data: { tenantId: actor.tenantId, actorId: actor.id, actorName: actor.fullName, action: "platform.google_workspace_storage_vault_provisioned", entityType: "TenantStorageProvider", entityId: row.id, metadata: JSON.stringify({ targetTenantId: tenant.id, schoolName: tenant.name, accountEmail, storageDomain: config.storageDomain, defaultStorageGb: config.defaultStorageGb, liveGoogleCall: false }) } });
  return row;
}
