-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Curriculum" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Kenya',
    "context" TEXT,
    "activeVersion" TEXT NOT NULL DEFAULT 'v1',
    "effectiveFrom" TEXT,
    "effectiveTo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "previousVersionId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Curriculum_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Curriculum_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "Curriculum" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Curriculum" ("activeVersion", "context", "country", "createdAt", "effectiveFrom", "effectiveTo", "id", "isActive", "name", "notes", "tenantId", "updatedAt") SELECT "activeVersion", "context", "country", "createdAt", "effectiveFrom", "effectiveTo", "id", "isActive", "name", "notes", "tenantId", "updatedAt" FROM "Curriculum";
DROP TABLE "Curriculum";
ALTER TABLE "new_Curriculum" RENAME TO "Curriculum";
CREATE INDEX "Curriculum_tenantId_isActive_idx" ON "Curriculum"("tenantId", "isActive");
CREATE UNIQUE INDEX "Curriculum_tenantId_name_activeVersion_key" ON "Curriculum"("tenantId", "name", "activeVersion");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
