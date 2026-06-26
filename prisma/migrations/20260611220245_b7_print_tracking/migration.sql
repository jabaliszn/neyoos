-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "structureId" TEXT,
    "description" TEXT NOT NULL,
    "totalKes" INTEGER NOT NULL,
    "paidKes" INTEGER NOT NULL DEFAULT 0,
    "discountKes" INTEGER NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "reminderSentAt" DATETIME,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "lastPrintedAt" DATETIME,
    "lastPrintedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "dueDate" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "FeeStructure" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("createdAt", "description", "discountKes", "discountReason", "dueDate", "id", "invoiceNo", "paidKes", "reminderSentAt", "status", "structureId", "studentId", "tenantId", "term", "totalKes", "updatedAt", "year") SELECT "createdAt", "description", "discountKes", "discountReason", "dueDate", "id", "invoiceNo", "paidKes", "reminderSentAt", "status", "structureId", "studentId", "tenantId", "term", "totalKes", "updatedAt", "year" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_tenantId_studentId_idx" ON "Invoice"("tenantId", "studentId");
CREATE INDEX "Invoice_tenantId_status_dueDate_idx" ON "Invoice"("tenantId", "status", "dueDate");
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNo_key" ON "Invoice"("tenantId", "invoiceNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
