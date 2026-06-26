-- I.21 — records for exam applications and assembled exam materials.
CREATE TABLE "ExamMaterialRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "examName" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "examDate" TEXT,
    "deadline" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "checklistJson" TEXT,
    "hardcopyLocation" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamMaterialRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ExamMaterialRecord_tenantId_status_idx" ON "ExamMaterialRecord"("tenantId", "status");
CREATE INDEX "ExamMaterialRecord_tenantId_examDate_idx" ON "ExamMaterialRecord"("tenantId", "examDate");
CREATE INDEX "ExamMaterialRecord_tenantId_deadline_idx" ON "ExamMaterialRecord"("tenantId", "deadline");
