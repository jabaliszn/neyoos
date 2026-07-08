-- CreateTable
CREATE TABLE "StorageOptimizerRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "triggeredByName" TEXT NOT NULL DEFAULT 'Storage Intelligence Engine',
    "duplicateFilesFound" INTEGER NOT NULL DEFAULT 0,
    "duplicateBytesFound" BIGINT NOT NULL DEFAULT 0,
    "temporaryFilesDeleted" INTEGER NOT NULL DEFAULT 0,
    "temporaryBytesFreed" BIGINT NOT NULL DEFAULT 0,
    "unusedFilesFlagged" INTEGER NOT NULL DEFAULT 0,
    "totalBytesFreed" BIGINT NOT NULL DEFAULT 0,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorageOptimizerRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StoredFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "provider" TEXT NOT NULL DEFAULT 'LOCAL_OR_R2',
    "providerObjectId" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "encryptionMode" TEXT,
    "checksumSha256" TEXT,
    "wrappedKeyRef" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifecycleTier" TEXT NOT NULL DEFAULT 'PERMANENT',
    "lastAccessedAt" DATETIME,
    CONSTRAINT "StoredFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StoredFile" ("category", "checksumSha256", "contentType", "createdAt", "encrypted", "encryptionMode", "fileName", "id", "key", "provider", "providerObjectId", "size", "tenantId", "uploadedById", "url", "wrappedKeyRef") SELECT "category", "checksumSha256", "contentType", "createdAt", "encrypted", "encryptionMode", "fileName", "id", "key", "provider", "providerObjectId", "size", "tenantId", "uploadedById", "url", "wrappedKeyRef" FROM "StoredFile";
DROP TABLE "StoredFile";
ALTER TABLE "new_StoredFile" RENAME TO "StoredFile";
CREATE UNIQUE INDEX "StoredFile_key_key" ON "StoredFile"("key");
CREATE INDEX "StoredFile_tenantId_idx" ON "StoredFile"("tenantId");
CREATE INDEX "StoredFile_category_idx" ON "StoredFile"("category");
CREATE INDEX "StoredFile_lifecycleTier_idx" ON "StoredFile"("lifecycleTier");
CREATE TABLE "new_TenantPricingSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentCount" INTEGER NOT NULL,
    "staffCount" INTEGER NOT NULL,
    "parentCount" INTEGER NOT NULL,
    "estimatedStorageGb" REAL NOT NULL,
    "estimatedAiOcrUsage" REAL NOT NULL DEFAULT 0,
    "alumniRecordCount" INTEGER NOT NULL DEFAULT 0,
    "alumniStorageGbAdded" REAL NOT NULL DEFAULT 0,
    "alumniFactorApplied" BOOLEAN NOT NULL DEFAULT false,
    "rawScore" REAL NOT NULL,
    "monthlyPriceKes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "triggeredById" TEXT,
    "triggeredByName" TEXT,
    "note" TEXT,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantPricingSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TenantPricingSnapshot" ("calculatedAt", "estimatedAiOcrUsage", "estimatedStorageGb", "id", "monthlyPriceKes", "note", "parentCount", "rawScore", "reason", "staffCount", "studentCount", "tenantId", "triggeredById", "triggeredByName") SELECT "calculatedAt", "estimatedAiOcrUsage", "estimatedStorageGb", "id", "monthlyPriceKes", "note", "parentCount", "rawScore", "reason", "staffCount", "studentCount", "tenantId", "triggeredById", "triggeredByName" FROM "TenantPricingSnapshot";
DROP TABLE "TenantPricingSnapshot";
ALTER TABLE "new_TenantPricingSnapshot" RENAME TO "TenantPricingSnapshot";
CREATE INDEX "TenantPricingSnapshot_tenantId_idx" ON "TenantPricingSnapshot"("tenantId");
CREATE INDEX "TenantPricingSnapshot_tenantId_calculatedAt_idx" ON "TenantPricingSnapshot"("tenantId", "calculatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StorageOptimizerRun_tenantId_createdAt_idx" ON "StorageOptimizerRun"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "StorageOptimizerRun_createdAt_idx" ON "StorageOptimizerRun"("createdAt");
