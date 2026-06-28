-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TeacherSubject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "isStrong" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TeacherSubject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeacherSubject" ("id", "subjectId", "teacherId", "tenantId") SELECT "id", "subjectId", "teacherId", "tenantId" FROM "TeacherSubject";
DROP TABLE "TeacherSubject";
ALTER TABLE "new_TeacherSubject" RENAME TO "TeacherSubject";
CREATE INDEX "TeacherSubject_tenantId_idx" ON "TeacherSubject"("tenantId");
CREATE UNIQUE INDEX "TeacherSubject_tenantId_teacherId_subjectId_key" ON "TeacherSubject"("tenantId", "teacherId", "subjectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
