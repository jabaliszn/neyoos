CREATE TABLE "ClassGroupingRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "targetLevel" TEXT,
  "ruleType" TEXT NOT NULL DEFAULT 'SUBJECT_SET',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "configJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ClassGroupingRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ClassGroupingRule_tenantId_targetLevel_active_idx" ON "ClassGroupingRule"("tenantId", "targetLevel", "active");

CREATE TABLE "TeacherWorkloadRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "teacherId" TEXT,
  "maxClasses" INTEGER,
  "maxLessonsPerWeek" INTEGER,
  "retainSubjectLoads" BOOLEAN NOT NULL DEFAULT true,
  "retainClassTeacher" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TeacherWorkloadRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TeacherWorkloadRule_tenantId_teacherId_idx" ON "TeacherWorkloadRule"("tenantId", "teacherId");
