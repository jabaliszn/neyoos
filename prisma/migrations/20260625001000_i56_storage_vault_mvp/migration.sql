-- I.56 — Storage Vault MVP: provider config, usage snapshots, encrypted-file metadata.
CREATE TABLE "TenantStorageProvider" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'NEYO_MANAGED_OBJECT_STORAGE',
  "status" TEXT NOT NULL DEFAULT 'DESIGN_READY',
  "accountEmail" TEXT,
  "rootFolderId" TEXT,
  "storageLimitBytes" BIGINT NOT NULL DEFAULT 16106127360,
  "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
  "encryptionMode" TEXT NOT NULL DEFAULT 'AES_256_GCM_ENVELOPE',
  "healthStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
  "lastHealthCheckAt" DATETIME,
  "lastUpgradePromptAt" DATETIME,
  "upgradePlan" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TenantStorageProvider_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TenantStorageProvider_tenantId_key" ON "TenantStorageProvider"("tenantId");
CREATE INDEX "TenantStorageProvider_tenantId_status_idx" ON "TenantStorageProvider"("tenantId", "status");
CREATE INDEX "TenantStorageProvider_provider_healthStatus_idx" ON "TenantStorageProvider"("provider", "healthStatus");

CREATE TABLE "StorageUsageSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "usedBytes" BIGINT NOT NULL,
  "limitBytes" BIGINT NOT NULL,
  "percentUsed" INTEGER NOT NULL,
  "healthStatus" TEXT NOT NULL,
  "actionRequired" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorageUsageSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StorageUsageSnapshot_tenantId_createdAt_idx" ON "StorageUsageSnapshot"("tenantId", "createdAt");
CREATE INDEX "StorageUsageSnapshot_healthStatus_idx" ON "StorageUsageSnapshot"("healthStatus");

ALTER TABLE "StoredFile" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'LOCAL_OR_R2';
ALTER TABLE "StoredFile" ADD COLUMN "providerObjectId" TEXT;
ALTER TABLE "StoredFile" ADD COLUMN "encrypted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoredFile" ADD COLUMN "encryptionMode" TEXT;
ALTER TABLE "StoredFile" ADD COLUMN "checksumSha256" TEXT;
ALTER TABLE "StoredFile" ADD COLUMN "wrappedKeyRef" TEXT;
