-- CreateTable
CREATE TABLE "TenantPricingSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentCount" INTEGER NOT NULL,
    "staffCount" INTEGER NOT NULL,
    "parentCount" INTEGER NOT NULL,
    "estimatedStorageGb" REAL NOT NULL,
    "estimatedAiOcrUsage" REAL NOT NULL DEFAULT 0,
    "rawScore" REAL NOT NULL,
    "monthlyPriceKes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "triggeredById" TEXT,
    "triggeredByName" TEXT,
    "note" TEXT,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantPricingSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolQuoteRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "schoolName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "declaredStudentCount" INTEGER,
    "declaredStaffCount" INTEGER,
    "declaredParentCount" INTEGER,
    "requestedEstimate" BOOLEAN NOT NULL DEFAULT false,
    "instantQuotedPriceKes" INTEGER,
    "formalQuoteRequested" BOOLEAN NOT NULL DEFAULT false,
    "finalQuotedPriceKes" INTEGER,
    "quotedById" TEXT,
    "quotedByName" TEXT,
    "quotedAt" DATETIME,
    "quotePdfUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "onboardingAssistanceRequested" BOOLEAN NOT NULL DEFAULT false,
    "onboardingAssistanceNote" TEXT,
    "onboardingAssistanceDoneAt" DATETIME,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolQuoteRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL DEFAULT 'free_karibu',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "grandfatheredPrice" INTEGER NOT NULL DEFAULT 0,
    "addOns" TEXT,
    "pricingMode" TEXT NOT NULL DEFAULT 'SIZE_BASED_V2',
    "sizeBasedPriceKes" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodStart" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" DATETIME NOT NULL,
    "graceEndsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("addOns", "createdAt", "currentPeriodEnd", "currentPeriodStart", "graceEndsAt", "grandfatheredPrice", "id", "planKey", "status", "tenantId", "updatedAt") SELECT "addOns", "createdAt", "currentPeriodEnd", "currentPeriodStart", "graceEndsAt", "grandfatheredPrice", "id", "planKey", "status", "tenantId", "updatedAt" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "neyoLoginId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'RECEPTIONIST',
    "secondaryRole" TEXT,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "popupStyle" TEXT NOT NULL DEFAULT 'glass',
    "lgContrast" TEXT NOT NULL DEFAULT 'company',
    "shellVersion" TEXT,
    "canApplyDiscretionaryDecrease" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "fullName", "id", "isActive", "language", "lgContrast", "neyoLoginId", "passwordHash", "phone", "popupStyle", "role", "secondaryRole", "shellVersion", "tenantId", "totpEnabled", "totpSecret", "totpVerifiedAt", "updatedAt") SELECT "createdAt", "email", "fullName", "id", "isActive", "language", "lgContrast", "neyoLoginId", "passwordHash", "phone", "popupStyle", "role", "secondaryRole", "shellVersion", "tenantId", "totpEnabled", "totpSecret", "totpVerifiedAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_neyoLoginId_key" ON "User"("neyoLoginId");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "User_role_idx" ON "User"("role");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TenantPricingSnapshot_tenantId_idx" ON "TenantPricingSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "TenantPricingSnapshot_tenantId_calculatedAt_idx" ON "TenantPricingSnapshot"("tenantId", "calculatedAt");

-- CreateIndex
CREATE INDEX "SchoolQuoteRequest_status_idx" ON "SchoolQuoteRequest"("status");

-- CreateIndex
CREATE INDEX "SchoolQuoteRequest_tenantId_idx" ON "SchoolQuoteRequest"("tenantId");
