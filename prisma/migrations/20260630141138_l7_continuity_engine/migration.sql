CREATE TABLE "TeacherContinuityAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "levelKey" TEXT NOT NULL,
  "subjectId" TEXT,
  "classId" TEXT,
  "teacherId" TEXT NOT NULL,
  "roleType" TEXT NOT NULL DEFAULT 'SUBJECT',
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TeacherContinuityAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TeacherContinuityAssignment_tenantId_levelKey_roleType_active_idx" ON "TeacherContinuityAssignment"("tenantId", "levelKey", "roleType", "active");
CREATE INDEX "TeacherContinuityAssignment_tenantId_teacherId_active_idx" ON "TeacherContinuityAssignment"("tenantId", "teacherId", "active");
