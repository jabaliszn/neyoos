CREATE TABLE "ExamTimetableGeneratorRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "examName" TEXT NOT NULL,
  "classIdsJson" TEXT NOT NULL DEFAULT '[]',
  "periodJson" TEXT NOT NULL DEFAULT '[]',
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "paperMode" TEXT NOT NULL DEFAULT 'ALL_SUBJECTS_SELECTED_CLASSES',
  "distributionMode" TEXT NOT NULL DEFAULT 'ONE_PAPER_PER_CLASS_PER_PERIOD',
  "generatedCount" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamTimetableGeneratorRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ExamTimetableGeneratorRun_tenantId_examName_idx" ON "ExamTimetableGeneratorRun"("tenantId", "examName");
