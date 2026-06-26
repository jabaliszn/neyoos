CREATE TABLE "SyllabusTopic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT,
    "topic" TEXT NOT NULL,
    "scopeRef" TEXT,
    "deadline" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "coveredAt" DATETIME,
    "teacherId" TEXT,
    "teacherName" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SyllabusTopic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SyllabusTopic_tenantId_classId_subjectId_idx" ON "SyllabusTopic"("tenantId", "classId", "subjectId");
CREATE INDEX "SyllabusTopic_tenantId_status_deadline_idx" ON "SyllabusTopic"("tenantId", "status", "deadline");
