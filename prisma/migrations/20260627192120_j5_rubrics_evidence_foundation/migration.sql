-- AlterTable
ALTER TABLE "AssessmentPlan" ADD COLUMN "rubricId" TEXT;

-- AlterTable
ALTER TABLE "AssessmentRecord" ADD COLUMN "rubricId" TEXT;

-- AlterTable
ALTER TABLE "AssessmentType" ADD COLUMN "rubricId" TEXT;

-- AlterTable
ALTER TABLE "Competency" ADD COLUMN "rubricId" TEXT;

-- AlterTable
ALTER TABLE "CompetencyEvidence" ADD COLUMN "rubricId" TEXT;

-- CreateTable
CREATE TABLE "Rubric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rubric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RubricLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "descriptor" TEXT,
    "points" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RubricLevel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RubricLevel_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "Rubric" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Rubric_tenantId_category_idx" ON "Rubric"("tenantId", "category");

-- CreateIndex
CREATE INDEX "Rubric_tenantId_isArchived_idx" ON "Rubric"("tenantId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "Rubric_tenantId_name_key" ON "Rubric"("tenantId", "name");

-- CreateIndex
CREATE INDEX "RubricLevel_tenantId_rubricId_idx" ON "RubricLevel"("tenantId", "rubricId");

-- CreateIndex
CREATE UNIQUE INDEX "RubricLevel_tenantId_rubricId_level_key" ON "RubricLevel"("tenantId", "rubricId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "RubricLevel_tenantId_rubricId_code_key" ON "RubricLevel"("tenantId", "rubricId", "code");
