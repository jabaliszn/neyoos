-- CreateTable
CREATE TABLE "BundiLearnedCorrection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "wrongText" TEXT NOT NULL,
    "correctText" TEXT NOT NULL,
    "timesSeen" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BundiLearnedCorrection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundiDocumentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "layoutSignature" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldsJson" TEXT NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BundiDocumentTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT,
    "source" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "createdRows" INTEGER NOT NULL,
    "failedRows" INTEGER NOT NULL,
    "errorRows" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT,
    "source" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "createdRows" INTEGER NOT NULL,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL,
    "errorRows" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BundiFieldTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'STUDENT',
    "fieldsJson" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BundiFieldTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BundiFieldTemplate" ("createdAt", "fieldsJson", "id", "tenantId", "updatedAt", "updatedById") SELECT "createdAt", "fieldsJson", "id", "tenantId", "updatedAt", "updatedById" FROM "BundiFieldTemplate";
DROP TABLE "BundiFieldTemplate";
ALTER TABLE "new_BundiFieldTemplate" RENAME TO "BundiFieldTemplate";
CREATE UNIQUE INDEX "BundiFieldTemplate_tenantId_domain_key" ON "BundiFieldTemplate"("tenantId", "domain");
CREATE TABLE "new_BundiImportSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "unlockCodeId" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'STUDENT',
    "contextNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "ocrConfidenceAvgPct" INTEGER,
    "fieldsTotal" INTEGER NOT NULL DEFAULT 0,
    "fieldsAiEscalated" INTEGER NOT NULL DEFAULT 0,
    "aiInvoked" BOOLEAN NOT NULL DEFAULT false,
    "templateMatchId" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" REAL NOT NULL DEFAULT 0,
    "costKes" REAL NOT NULL DEFAULT 0,
    "extractedRowsJson" TEXT,
    "reviewedRowsJson" TEXT,
    "errorMessage" TEXT,
    "studentImportId" TEXT,
    "staffImportId" TEXT,
    "libraryImportId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BundiImportSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BundiImportSession_unlockCodeId_fkey" FOREIGN KEY ("unlockCodeId") REFERENCES "BundiImportUnlockCode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BundiImportSession" ("costKes", "costUsd", "createdAt", "createdById", "createdByName", "errorMessage", "extractedRowsJson", "fileKey", "fileName", "id", "model", "outputTokens", "pageCount", "promptTokens", "provider", "reviewedRowsJson", "status", "studentImportId", "tenantId", "unlockCodeId", "updatedAt") SELECT "costKes", "costUsd", "createdAt", "createdById", "createdByName", "errorMessage", "extractedRowsJson", "fileKey", "fileName", "id", "model", "outputTokens", "pageCount", "promptTokens", "provider", "reviewedRowsJson", "status", "studentImportId", "tenantId", "unlockCodeId", "updatedAt" FROM "BundiImportSession";
DROP TABLE "BundiImportSession";
ALTER TABLE "new_BundiImportSession" RENAME TO "BundiImportSession";
CREATE INDEX "BundiImportSession_tenantId_status_idx" ON "BundiImportSession"("tenantId", "status");
CREATE INDEX "BundiImportSession_tenantId_domain_idx" ON "BundiImportSession"("tenantId", "domain");
CREATE INDEX "BundiImportSession_unlockCodeId_idx" ON "BundiImportSession"("unlockCodeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BundiLearnedCorrection_tenantId_domain_idx" ON "BundiLearnedCorrection"("tenantId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "BundiLearnedCorrection_tenantId_domain_fieldLabel_wrongText_key" ON "BundiLearnedCorrection"("tenantId", "domain", "fieldLabel", "wrongText");

-- CreateIndex
CREATE INDEX "BundiDocumentTemplate_tenantId_domain_idx" ON "BundiDocumentTemplate"("tenantId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "BundiDocumentTemplate_tenantId_domain_layoutSignature_key" ON "BundiDocumentTemplate"("tenantId", "domain", "layoutSignature");

-- CreateIndex
CREATE INDEX "StaffImport_tenantId_createdAt_idx" ON "StaffImport"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "LibraryImport_tenantId_createdAt_idx" ON "LibraryImport"("tenantId", "createdAt");
