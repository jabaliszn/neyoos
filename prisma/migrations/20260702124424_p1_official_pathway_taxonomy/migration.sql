-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pathway" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "pathwayGroup" TEXT,
    "trackName" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Pathway_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Pathway" ("capacity", "code", "createdAt", "description", "id", "name", "tenantId", "updatedAt") SELECT "capacity", "code", "createdAt", "description", "id", "name", "tenantId", "updatedAt" FROM "Pathway";
DROP TABLE "Pathway";
ALTER TABLE "new_Pathway" RENAME TO "Pathway";
CREATE UNIQUE INDEX "Pathway_tenantId_code_key" ON "Pathway"("tenantId", "code");
CREATE TABLE "new_Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "county" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "osKey" TEXT NOT NULL DEFAULT 'school',
    "principalSignatureUrl" TEXT,
    "schoolStampUrl" TEXT,
    "curriculum" TEXT,
    "educationLevelsOffered" TEXT,
    "onboardedAt" DATETIME,
    "referralCode" TEXT,
    "referredByTenantId" TEXT,
    "hasClaimedReferral" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "demoExpiresAt" DATETIME,
    "schoolType" TEXT NOT NULL DEFAULT 'DAY',
    "uniformSupplierName" TEXT,
    "uniformSupplierPhone" TEXT,
    "pathwaySchoolType" TEXT NOT NULL DEFAULT 'NONE',
    "enabledPathwayGroups" TEXT DEFAULT '[]',
    "showReligiousHolidays" BOOLEAN NOT NULL DEFAULT true,
    "libraryFinesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "libraryFinePerDayKes" INTEGER NOT NULL DEFAULT 10,
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
    "documentDesignJson" TEXT,
    "gpsLat" REAL,
    "gpsLng" REAL,
    "gpsRadiusM" INTEGER,
    "collectionTargetPct" INTEGER NOT NULL DEFAULT 85,
    "poApprovalThresholdKes" INTEGER NOT NULL DEFAULT 50000,
    "expenseApprovalThresholdKes" INTEGER NOT NULL DEFAULT 20000,
    "siblingDiscountPct" INTEGER NOT NULL DEFAULT 0,
    "enforce2Fa" BOOLEAN NOT NULL DEFAULT false,
    "requireJointOwnerApproval" BOOLEAN NOT NULL DEFAULT false,
    "printLimitPerDay" INTEGER DEFAULT 0,
    "printStationMode" TEXT NOT NULL DEFAULT 'AUTO',
    "cafeteriaTableSize" INTEGER NOT NULL DEFAULT 8,
    "cafeteriaMealModel" TEXT NOT NULL DEFAULT 'HYBRID',
    "cafeteriaMealScope" TEXT NOT NULL DEFAULT 'ALL',
    "navVisibility" TEXT,
    "encryptedDek" TEXT,
    "dekIv" TEXT,
    "dekTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tenant_referredByTenantId_fkey" FOREIGN KEY ("referredByTenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Tenant" ("about", "addressLine", "brandAccent", "brandPrimary", "cafeteriaMealModel", "cafeteriaMealScope", "cafeteriaTableSize", "collectionTargetPct", "county", "createdAt", "curriculum", "dekIv", "dekTag", "demoExpiresAt", "documentDesignJson", "educationLevelsOffered", "email", "encryptedDek", "enforce2Fa", "expenseApprovalThresholdKes", "gpsLat", "gpsLng", "gpsRadiusM", "hasClaimedReferral", "id", "isDemo", "joiningRequirements", "libraryFinePerDayKes", "libraryFinesEnabled", "logoUrl", "mission", "motto", "name", "navVisibility", "onboardedAt", "osKey", "phone", "poApprovalThresholdKes", "principalSignatureUrl", "printLimitPerDay", "printStationMode", "referralCode", "referredByTenantId", "requireJointOwnerApproval", "schoolStampUrl", "schoolType", "showReligiousHolidays", "siblingDiscountPct", "slug", "socialLinks", "uniformSupplierName", "uniformSupplierPhone", "updatedAt", "vision") SELECT "about", "addressLine", "brandAccent", "brandPrimary", "cafeteriaMealModel", "cafeteriaMealScope", "cafeteriaTableSize", "collectionTargetPct", "county", "createdAt", "curriculum", "dekIv", "dekTag", "demoExpiresAt", "documentDesignJson", "educationLevelsOffered", "email", "encryptedDek", "enforce2Fa", "expenseApprovalThresholdKes", "gpsLat", "gpsLng", "gpsRadiusM", "hasClaimedReferral", "id", "isDemo", "joiningRequirements", "libraryFinePerDayKes", "libraryFinesEnabled", "logoUrl", "mission", "motto", "name", "navVisibility", "onboardedAt", "osKey", "phone", "poApprovalThresholdKes", "principalSignatureUrl", "printLimitPerDay", "printStationMode", "referralCode", "referredByTenantId", "requireJointOwnerApproval", "schoolStampUrl", "schoolType", "showReligiousHolidays", "siblingDiscountPct", "slug", "socialLinks", "uniformSupplierName", "uniformSupplierPhone", "updatedAt", "vision" FROM "Tenant";
DROP TABLE "Tenant";
ALTER TABLE "new_Tenant" RENAME TO "Tenant";
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "Tenant_referralCode_key" ON "Tenant"("referralCode");
CREATE INDEX "Tenant_osKey_idx" ON "Tenant"("osKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
