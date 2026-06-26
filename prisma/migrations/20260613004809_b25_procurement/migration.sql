-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "neededBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseQuote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "amountKes" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseQuote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseQuote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "poNo" TEXT NOT NULL,
    "requestId" TEXT,
    "quoteId" TEXT,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalKes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" DATETIME,
    "deliveredAt" DATETIME,
    "deliveredNote" TEXT,
    "deliveredValueKes" INTEGER,
    "supplierInvoiceNo" TEXT,
    "supplierInvoiceKes" INTEGER,
    "matchedAt" DATETIME,
    "matchOk" BOOLEAN,
    "matchNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "encryptedDek" TEXT,
    "dekIv" TEXT,
    "dekTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Tenant" ("about", "addressLine", "brandAccent", "brandPrimary", "collectionTargetPct", "county", "createdAt", "curriculum", "dekIv", "dekTag", "email", "encryptedDek", "gpsLat", "gpsLng", "gpsRadiusM", "id", "joiningRequirements", "logoUrl", "mission", "motto", "name", "onboardedAt", "phone", "schoolType", "showReligiousHolidays", "slug", "socialLinks", "uniformSupplierName", "uniformSupplierPhone", "updatedAt", "vision") SELECT "about", "addressLine", "brandAccent", "brandPrimary", "collectionTargetPct", "county", "createdAt", "curriculum", "dekIv", "dekTag", "email", "encryptedDek", "gpsLat", "gpsLng", "gpsRadiusM", "id", "joiningRequirements", "logoUrl", "mission", "motto", "name", "onboardedAt", "phone", "schoolType", "showReligiousHolidays", "slug", "socialLinks", "uniformSupplierName", "uniformSupplierPhone", "updatedAt", "vision" FROM "Tenant";
DROP TABLE "Tenant";
ALTER TABLE "new_Tenant" RENAME TO "Tenant";
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PurchaseRequest_tenantId_status_idx" ON "PurchaseRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PurchaseQuote_tenantId_requestId_idx" ON "PurchaseQuote"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_tenantId_status_idx" ON "PurchaseOrder"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_poNo_key" ON "PurchaseOrder"("tenantId", "poNo");
