-- CreateTable
CREATE TABLE "AssetMaintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SERVICE',
    "costKes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "byName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetMaintenance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetMaintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT,
    "custodian" TEXT,
    "acquiredOn" TEXT,
    "valueKes" INTEGER NOT NULL DEFAULT 0,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "depreciationPctPerYear" INTEGER NOT NULL DEFAULT 0,
    "nextMaintenanceOn" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("acquiredOn", "archived", "category", "condition", "createdAt", "custodian", "id", "location", "name", "tag", "tenantId", "valueKes") SELECT "acquiredOn", "archived", "category", "condition", "createdAt", "custodian", "id", "location", "name", "tag", "tenantId", "valueKes" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE INDEX "Asset_tenantId_idx" ON "Asset"("tenantId");
CREATE UNIQUE INDEX "Asset_tenantId_tag_key" ON "Asset"("tenantId", "tag");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AssetMaintenance_tenantId_assetId_idx" ON "AssetMaintenance"("tenantId", "assetId");
