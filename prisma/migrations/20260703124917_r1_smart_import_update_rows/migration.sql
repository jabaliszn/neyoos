-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StudentImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT,
    "source" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "createdRows" INTEGER NOT NULL,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL,
    "errorRows" TEXT,
    "targetClassId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StudentImport" ("createdAt", "createdById", "createdByName", "createdRows", "errorRows", "failedRows", "fileName", "id", "source", "targetClassId", "tenantId", "totalRows") SELECT "createdAt", "createdById", "createdByName", "createdRows", "errorRows", "failedRows", "fileName", "id", "source", "targetClassId", "tenantId", "totalRows" FROM "StudentImport";
DROP TABLE "StudentImport";
ALTER TABLE "new_StudentImport" RENAME TO "StudentImport";
CREATE INDEX "StudentImport_tenantId_createdAt_idx" ON "StudentImport"("tenantId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
