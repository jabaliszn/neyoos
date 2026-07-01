CREATE TABLE "TeacherTransferImpact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "replacementTeacherId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reason" TEXT,
  "affectedJson" TEXT NOT NULL DEFAULT '[]',
  "recommendationJson" TEXT NOT NULL DEFAULT '[]',
  "timetableJobId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TeacherTransferImpact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TeacherTransferImpact_tenantId_teacherId_status_idx" ON "TeacherTransferImpact"("tenantId", "teacherId", "status");
