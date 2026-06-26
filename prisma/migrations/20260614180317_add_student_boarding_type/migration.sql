-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "graduationYear" INTEGER,
    "finalClassLabel" TEXT,
    "upiNumber" TEXT,
    "birthCertNo" TEXT,
    "classId" TEXT,
    "boardingType" TEXT NOT NULL DEFAULT 'BOARDER',
    "userId" TEXT,
    "admittedOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("admissionNo", "admittedOn", "birthCertNo", "classId", "createdAt", "dateOfBirth", "deletedAt", "deletedById", "finalClassLabel", "firstName", "gender", "graduationYear", "id", "lastName", "middleName", "notes", "photoUrl", "status", "tenantId", "updatedAt", "upiNumber", "userId") SELECT "admissionNo", "admittedOn", "birthCertNo", "classId", "createdAt", "dateOfBirth", "deletedAt", "deletedById", "finalClassLabel", "firstName", "gender", "graduationYear", "id", "lastName", "middleName", "notes", "photoUrl", "status", "tenantId", "updatedAt", "upiNumber", "userId" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
CREATE INDEX "Student_tenantId_idx" ON "Student"("tenantId");
CREATE INDEX "Student_tenantId_status_idx" ON "Student"("tenantId", "status");
CREATE INDEX "Student_tenantId_classId_idx" ON "Student"("tenantId", "classId");
CREATE INDEX "Student_deletedAt_idx" ON "Student"("deletedAt");
CREATE UNIQUE INDEX "Student_tenantId_admissionNo_key" ON "Student"("tenantId", "admissionNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
