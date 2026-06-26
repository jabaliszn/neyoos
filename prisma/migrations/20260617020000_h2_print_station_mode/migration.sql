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
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "demoExpiresAt" DATETIME,
    "schoolType" TEXT NOT NULL DEFAULT 'DAY',
    "uniformSupplierName" TEXT,
    "uniformSupplierPhone" TEXT,
    "showReligiousHolidays" BOOLEAN NOT NULL DEFAULT true,
    "libraryFinesEnabled" BOOLEAN NOT NULL DEFAULT true,
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
    "collectionTargetPct" INTEGER NOT NULL DEFAULT 85,
    "poApprovalThresholdKes" INTEGER NOT NULL DEFAULT 50000,
    "expenseApprovalThresholdKes" INTEGER NOT NULL DEFAULT 20000,
    "siblingDiscountPct" INTEGER NOT NULL DEFAULT 0,
    "enforce2Fa" BOOLEAN NOT NULL DEFAULT false,
    "printLimitPerDay" INTEGER DEFAULT 0,
    "printStationMode" TEXT NOT NULL DEFAULT 'AUTO',
    "encryptedDek" TEXT,
    "dekIv" TEXT,
    "dekTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Tenant" ("about", "addressLine", "brandAccent", "brandPrimary", "collectionTargetPct", "county", "createdAt", "curriculum", "dekIv", "dekTag", "demoExpiresAt", "email", "encryptedDek", "enforce2Fa", "expenseApprovalThresholdKes", "gpsLat", "gpsLng", "gpsRadiusM", "id", "isDemo", "joiningRequirements", "libraryFinesEnabled", "logoUrl", "mission", "motto", "name", "onboardedAt", "phone", "poApprovalThresholdKes", "printLimitPerDay", "schoolType", "showReligiousHolidays", "siblingDiscountPct", "slug", "socialLinks", "uniformSupplierName", "uniformSupplierPhone", "updatedAt", "vision") SELECT "about", "addressLine", "brandAccent", "brandPrimary", "collectionTargetPct", "county", "createdAt", "curriculum", "dekIv", "dekTag", "demoExpiresAt", "email", "encryptedDek", "enforce2Fa", "expenseApprovalThresholdKes", "gpsLat", "gpsLng", "gpsRadiusM", "id", "isDemo", "joiningRequirements", "libraryFinesEnabled", "logoUrl", "mission", "motto", "name", "onboardedAt", "phone", "poApprovalThresholdKes", "printLimitPerDay", "schoolType", "showReligiousHolidays", "siblingDiscountPct", "slug", "socialLinks", "uniformSupplierName", "uniformSupplierPhone", "updatedAt", "vision" FROM "Tenant";
DROP TABLE "Tenant";
ALTER TABLE "new_Tenant" RENAME TO "Tenant";
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

