-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    CONSTRAINT "FeeStructure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "structureId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountKes" INTEGER NOT NULL,
    CONSTRAINT "FeeItem_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "FeeStructure" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "structureId" TEXT,
    "description" TEXT NOT NULL,
    "totalKes" INTEGER NOT NULL,
    "paidKes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "dueDate" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "FeeStructure" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_tenantId_level_year_term_key" ON "FeeStructure"("tenantId", "level", "year", "term");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_studentId_idx" ON "Invoice"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_dueDate_idx" ON "Invoice"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNo_key" ON "Invoice"("tenantId", "invoiceNo");
