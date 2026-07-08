-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TenantStorageProvider" (
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
    "linkedStorageUrl" TEXT,
    "linkedStorageLabel" TEXT,
    "linkedStorageProvider" TEXT,
    "linkedStorageAddedById" TEXT,
    "linkedStorageAddedAt" DATETIME,
    "linkedStorageVerifiedAt" DATETIME,
    "linkedStorageLastCheckOk" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenantStorageProvider_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TenantStorageProvider" ("accountEmail", "createdAt", "encryptionMode", "healthStatus", "id", "lastHealthCheckAt", "lastUpgradePromptAt", "notes", "provider", "rootFolderId", "status", "storageLimitBytes", "storageUsedBytes", "tenantId", "updatedAt", "upgradePlan") SELECT "accountEmail", "createdAt", "encryptionMode", "healthStatus", "id", "lastHealthCheckAt", "lastUpgradePromptAt", "notes", "provider", "rootFolderId", "status", "storageLimitBytes", "storageUsedBytes", "tenantId", "updatedAt", "upgradePlan" FROM "TenantStorageProvider";
DROP TABLE "TenantStorageProvider";
ALTER TABLE "new_TenantStorageProvider" RENAME TO "TenantStorageProvider";
CREATE UNIQUE INDEX "TenantStorageProvider_tenantId_key" ON "TenantStorageProvider"("tenantId");
CREATE INDEX "TenantStorageProvider_tenantId_status_idx" ON "TenantStorageProvider"("tenantId", "status");
CREATE INDEX "TenantStorageProvider_provider_healthStatus_idx" ON "TenantStorageProvider"("provider", "healthStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
