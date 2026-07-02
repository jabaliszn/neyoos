-- CreateTable
CREATE TABLE "BundiImportUnlockCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "tenantId" TEXT,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "note" TEXT,
    "issuedById" TEXT NOT NULL,
    "issuedByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BundiImportUnlockCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundiFieldTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "fieldsJson" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BundiFieldTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundiImportSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "unlockCodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
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
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BundiImportSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BundiImportSession_unlockCodeId_fkey" FOREIGN KEY ("unlockCodeId") REFERENCES "BundiImportUnlockCode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BundiImportUnlockCode_code_key" ON "BundiImportUnlockCode"("code");

-- CreateIndex
CREATE INDEX "BundiImportUnlockCode_tenantId_idx" ON "BundiImportUnlockCode"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BundiFieldTemplate_tenantId_key" ON "BundiFieldTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "BundiImportSession_tenantId_status_idx" ON "BundiImportSession"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BundiImportSession_unlockCodeId_idx" ON "BundiImportSession"("unlockCodeId");
