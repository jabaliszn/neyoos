-- AlterTable
ALTER TABLE "AssessmentType" ADD COLUMN "effectiveFrom" TEXT;
ALTER TABLE "AssessmentType" ADD COLUMN "effectiveTo" TEXT;

-- AlterTable
ALTER TABLE "Curriculum" ADD COLUMN "adoptedTemplateId" TEXT;
ALTER TABLE "Curriculum" ADD COLUMN "adoptedTemplateVersion" TEXT;

-- AlterTable
ALTER TABLE "GlobalCurriculumTemplate" ADD COLUMN "announcedAt" DATETIME;
ALTER TABLE "GlobalCurriculumTemplate" ADD COLUMN "changeNote" TEXT;
ALTER TABLE "GlobalCurriculumTemplate" ADD COLUMN "publishedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExamTimetableGeneratorRun" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamTimetableGeneratorRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExamTimetableGeneratorRun" ("classIdsJson", "createdAt", "createdById", "createdByName", "distributionMode", "endDate", "examName", "generatedCount", "id", "notes", "paperMode", "periodJson", "startDate", "tenantId", "updatedAt") SELECT "classIdsJson", "createdAt", "createdById", "createdByName", "distributionMode", "endDate", "examName", "generatedCount", "id", "notes", "paperMode", "periodJson", "startDate", "tenantId", "updatedAt" FROM "ExamTimetableGeneratorRun";
DROP TABLE "ExamTimetableGeneratorRun";
ALTER TABLE "new_ExamTimetableGeneratorRun" RENAME TO "ExamTimetableGeneratorRun";
CREATE INDEX "ExamTimetableGeneratorRun_tenantId_examName_idx" ON "ExamTimetableGeneratorRun"("tenantId", "examName");
CREATE TABLE "new_ReportTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "effectiveFrom" TEXT,
    "effectiveTo" TEXT,
    "curriculumVersion" TEXT,
    "sectionsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReportTemplate" ("createdAt", "description", "id", "isDefault", "name", "sectionsJson", "tenantId", "updatedAt") SELECT "createdAt", "description", "id", "isDefault", "name", "sectionsJson", "tenantId", "updatedAt" FROM "ReportTemplate";
DROP TABLE "ReportTemplate";
ALTER TABLE "new_ReportTemplate" RENAME TO "ReportTemplate";
CREATE UNIQUE INDEX "ReportTemplate_tenantId_name_key" ON "ReportTemplate"("tenantId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
