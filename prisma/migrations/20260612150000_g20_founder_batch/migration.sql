-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "UniformOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "size" TEXT,
    "qty" INTEGER NOT NULL,
    "unitKes" INTEGER NOT NULL,
    "totalKes" INTEGER NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "placedById" TEXT NOT NULL,
    "placedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" DATETIME,
    CONSTRAINT "UniformOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleKey" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "county" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "curriculum" TEXT,
    "onboardedAt" DATETIME,
    "schoolType" TEXT NOT NULL DEFAULT 'DAY',
    "uniformSupplierName" TEXT,
    "uniformSupplierPhone" TEXT,
    "showReligiousHolidays" BOOLEAN NOT NULL DEFAULT true,
    "motto" TEXT,
    "vision" TEXT,
    "mission" TEXT,
    "about" TEXT,
    "logoUrl" TEXT,
    "brandPrimary" TEXT,
    "brandAccent" TEXT,
    "addressLine" TEXT,
    "socialLinks" TEXT,
    "joiningRequirements" TEXT,
    "gpsLat" REAL,
    "gpsLng" REAL,
    "gpsRadiusM" INTEGER,
    "encryptedDek" TEXT,
    "dekIv" TEXT,
    "dekTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Tenant" ("about", "addressLine", "brandAccent", "brandPrimary", "county", "createdAt", "curriculum", "dekIv", "dekTag", "email", "encryptedDek", "gpsLat", "gpsLng", "gpsRadiusM", "id", "joiningRequirements", "logoUrl", "mission", "motto", "name", "onboardedAt", "phone", "showReligiousHolidays", "slug", "socialLinks", "updatedAt", "vision") SELECT "about", "addressLine", "brandAccent", "brandPrimary", "county", "createdAt", "curriculum", "dekIv", "dekTag", "email", "encryptedDek", "gpsLat", "gpsLng", "gpsRadiusM", "id", "joiningRequirements", "logoUrl", "mission", "motto", "name", "onboardedAt", "phone", "showReligiousHolidays", "slug", "socialLinks", "updatedAt", "vision" FROM "Tenant";
DROP TABLE "Tenant";
ALTER TABLE "new_Tenant" RENAME TO "Tenant";
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UniformOrder_tenantId_studentId_idx" ON "UniformOrder"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "UniformOrder_tenantId_status_idx" ON "UniformOrder"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UniformOrder_tenantId_orderNo_key" ON "UniformOrder"("tenantId", "orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFlag_moduleKey_key" ON "PlatformFlag"("moduleKey");

