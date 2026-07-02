-- CreateTable
CREATE TABLE "QrScanEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "detail" TEXT,
    "scannedById" TEXT NOT NULL,
    "scannedByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QrScanEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" TEXT,
    CONSTRAINT "DocumentVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentVerification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DocumentVerification" ("code", "createdAt", "docType", "id", "payloadHash", "summary", "tenantId") SELECT "code", "createdAt", "docType", "id", "payloadHash", "summary", "tenantId" FROM "DocumentVerification";
DROP TABLE "DocumentVerification";
ALTER TABLE "new_DocumentVerification" RENAME TO "DocumentVerification";
CREATE UNIQUE INDEX "DocumentVerification_code_key" ON "DocumentVerification"("code");
CREATE INDEX "DocumentVerification_tenantId_idx" ON "DocumentVerification"("tenantId");
CREATE INDEX "DocumentVerification_studentId_idx" ON "DocumentVerification"("studentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "QrScanEvent_tenantId_studentId_action_createdAt_idx" ON "QrScanEvent"("tenantId", "studentId", "action", "createdAt");
