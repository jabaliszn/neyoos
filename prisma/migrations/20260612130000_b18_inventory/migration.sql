-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Store_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "qty" REAL NOT NULL DEFAULT 0,
    "reorderLevel" REAL NOT NULL DEFAULT 0,
    "sellPriceKes" INTEGER,
    "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "expiryDate" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "reason" TEXT,
    "studentId" TEXT,
    "studentName" TEXT,
    "invoiceId" TEXT,
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
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
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Store_tenantId_idx" ON "Store"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_tenantId_name_key" ON "Store"("tenantId", "name");

-- CreateIndex
CREATE INDEX "StockItem_tenantId_storeId_idx" ON "StockItem"("tenantId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_tenantId_storeId_name_key" ON "StockItem"("tenantId", "storeId", "name");

-- CreateIndex
CREATE INDEX "StockBatch_tenantId_itemId_idx" ON "StockBatch"("tenantId", "itemId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_itemId_createdAt_idx" ON "StockMovement"("tenantId", "itemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_studentId_idx" ON "StockMovement"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Asset_tenantId_idx" ON "Asset"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_tenantId_tag_key" ON "Asset"("tenantId", "tag");

