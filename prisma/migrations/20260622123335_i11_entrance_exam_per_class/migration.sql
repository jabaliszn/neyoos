/*
  Warnings:

  - Added the required column `classLabel` to the `EntranceExamPaper` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `EntranceExamPaper` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EntranceExamPaper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT,
    "classLevel" TEXT NOT NULL,
    "classLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Entrance interview paper',
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "hardcopyLocation" TEXT NOT NULL DEFAULT 'Admissions office file',
    "uploadedById" TEXT,
    "uploadedBy" TEXT,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "lastPrintedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EntranceExamPaper_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EntranceExamPaper" ("classLevel", "classLabel", "createdAt", "updatedAt", "fileName", "fileUrl", "id", "tenantId", "uploadedBy")
SELECT "classLevel", "classLevel", "createdAt", "createdAt", "fileName", "fileUrl", "id", "tenantId", "uploadedBy" FROM "EntranceExamPaper";
DROP TABLE "EntranceExamPaper";
ALTER TABLE "new_EntranceExamPaper" RENAME TO "EntranceExamPaper";
CREATE INDEX "EntranceExamPaper_tenantId_classLabel_idx" ON "EntranceExamPaper"("tenantId", "classLabel");
CREATE UNIQUE INDEX "EntranceExamPaper_tenantId_classId_key" ON "EntranceExamPaper"("tenantId", "classId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
