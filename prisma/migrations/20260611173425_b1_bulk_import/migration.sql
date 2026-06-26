-- CreateTable
CREATE TABLE "StudentImport" (
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
    CONSTRAINT "StudentImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudentImport_tenantId_createdAt_idx" ON "StudentImport"("tenantId", "createdAt");
