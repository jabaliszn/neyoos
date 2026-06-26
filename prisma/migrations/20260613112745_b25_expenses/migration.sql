-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostCenter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "costCenterId" TEXT,
    "costCenterName" TEXT,
    "payee" TEXT NOT NULL,
    "amountKes" INTEGER NOT NULL,
    "spentOn" TEXT NOT NULL,
    "note" TEXT,
    "receiptFileUrl" TEXT,
    "receiptFileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" DATETIME,
    "rejectedReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "collectionTargetPct" INTEGER NOT NULL DEFAULT 85,
    "poApprovalThresholdKes" INTEGER NOT NULL DEFAULT 50000,
    "expenseApprovalThresholdKes" INTEGER NOT NULL DEFAULT 20000,
    "encryptedDek" TEXT,
    "dekIv" TEXT,
    "dekTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Tenant" ("about", "addressLine", "brandAccent", "brandPrimary", "collectionTargetPct", "county", "createdAt", "curriculum", "dekIv", "dekTag", "email", "encryptedDek", "gpsLat", "gpsLng", "gpsRadiusM", "id", "joiningRequirements", "logoUrl", "mission", "motto", "name", "onboardedAt", "phone", "poApprovalThresholdKes", "schoolType", "showReligiousHolidays", "slug", "socialLinks", "uniformSupplierName", "uniformSupplierPhone", "updatedAt", "vision") SELECT "about", "addressLine", "brandAccent", "brandPrimary", "collectionTargetPct", "county", "createdAt", "curriculum", "dekIv", "dekTag", "email", "encryptedDek", "gpsLat", "gpsLng", "gpsRadiusM", "id", "joiningRequirements", "logoUrl", "mission", "motto", "name", "onboardedAt", "phone", "poApprovalThresholdKes", "schoolType", "showReligiousHolidays", "slug", "socialLinks", "uniformSupplierName", "uniformSupplierPhone", "updatedAt", "vision" FROM "Tenant";
DROP TABLE "Tenant";
ALTER TABLE "new_Tenant" RENAME TO "Tenant";
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ExpenseCategory_tenantId_archived_idx" ON "ExpenseCategory"("tenantId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_tenantId_name_key" ON "ExpenseCategory"("tenantId", "name");

-- CreateIndex
CREATE INDEX "CostCenter_tenantId_archived_idx" ON "CostCenter"("tenantId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_tenantId_name_key" ON "CostCenter"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Expense_tenantId_status_idx" ON "Expense"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Expense_tenantId_spentOn_idx" ON "Expense"("tenantId", "spentOn");

