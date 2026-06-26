-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LeavingCertificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "certificateNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STORED',
    "fileUrl" TEXT,
    "fileName" TEXT,
    "hardcopyLocation" TEXT NOT NULL DEFAULT 'Unspecified',
    "handedOverTo" TEXT,
    "handedOverAt" DATETIME,
    "handedOverById" TEXT,
    "handedOverByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeavingCertificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LeavingCertificate" ("certificateNo", "certificateType", "createdAt", "fileName", "fileUrl", "handedOverAt", "handedOverById", "handedOverByName", "handedOverTo", "id", "status", "studentId", "tenantId", "updatedAt") SELECT "certificateNo", "certificateType", "createdAt", "fileName", "fileUrl", "handedOverAt", "handedOverById", "handedOverByName", "handedOverTo", "id", "status", "studentId", "tenantId", "updatedAt" FROM "LeavingCertificate";
DROP TABLE "LeavingCertificate";
ALTER TABLE "new_LeavingCertificate" RENAME TO "LeavingCertificate";
CREATE UNIQUE INDEX "LeavingCertificate_studentId_key" ON "LeavingCertificate"("studentId");
CREATE UNIQUE INDEX "LeavingCertificate_certificateNo_key" ON "LeavingCertificate"("certificateNo");
CREATE INDEX "LeavingCertificate_tenantId_idx" ON "LeavingCertificate"("tenantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
