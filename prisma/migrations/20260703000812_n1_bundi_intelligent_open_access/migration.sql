-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BundiImportSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "unlockCodeId" TEXT,
    "pipeline" TEXT NOT NULL DEFAULT 'BUNDI_INTELLIGENT',
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
    CONSTRAINT "BundiImportSession_unlockCodeId_fkey" FOREIGN KEY ("unlockCodeId") REFERENCES "BundiImportUnlockCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BundiImportSession" ("aiInvoked", "contextNote", "costKes", "costUsd", "createdAt", "createdById", "createdByName", "domain", "errorMessage", "extractedRowsJson", "fieldsAiEscalated", "fieldsTotal", "fileKey", "fileName", "id", "libraryImportId", "model", "ocrConfidenceAvgPct", "outputTokens", "pageCount", "promptTokens", "provider", "reviewedRowsJson", "staffImportId", "status", "studentImportId", "templateMatchId", "tenantId", "unlockCodeId", "updatedAt") SELECT "aiInvoked", "contextNote", "costKes", "costUsd", "createdAt", "createdById", "createdByName", "domain", "errorMessage", "extractedRowsJson", "fieldsAiEscalated", "fieldsTotal", "fileKey", "fileName", "id", "libraryImportId", "model", "ocrConfidenceAvgPct", "outputTokens", "pageCount", "promptTokens", "provider", "reviewedRowsJson", "staffImportId", "status", "studentImportId", "templateMatchId", "tenantId", "unlockCodeId", "updatedAt" FROM "BundiImportSession";
DROP TABLE "BundiImportSession";
ALTER TABLE "new_BundiImportSession" RENAME TO "BundiImportSession";
CREATE INDEX "BundiImportSession_tenantId_status_idx" ON "BundiImportSession"("tenantId", "status");
CREATE INDEX "BundiImportSession_tenantId_domain_idx" ON "BundiImportSession"("tenantId", "domain");
CREATE INDEX "BundiImportSession_unlockCodeId_idx" ON "BundiImportSession"("unlockCodeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
