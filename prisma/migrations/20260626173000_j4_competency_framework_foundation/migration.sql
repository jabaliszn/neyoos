-- CreateTable
CREATE TABLE "CompetencyGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "curriculumId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompetencyGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT,
    "curriculumId" TEXT,
    "learningAreaId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Competency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Competency_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CompetencyGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetencyEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "assessmentRecordId" TEXT,
    "cbcAssessmentId" TEXT,
    "level" INTEGER,
    "scorePct" INTEGER,
    "narrative" TEXT,
    "evidenceDate" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "visibleToParents" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompetencyEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompetencyEvidence_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CompetencyGroup_tenantId_curriculumId_idx" ON "CompetencyGroup"("tenantId", "curriculumId");

-- CreateIndex
CREATE INDEX "CompetencyGroup_tenantId_active_idx" ON "CompetencyGroup"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyGroup_tenantId_code_key" ON "CompetencyGroup"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Competency_tenantId_groupId_idx" ON "Competency"("tenantId", "groupId");

-- CreateIndex
CREATE INDEX "Competency_tenantId_curriculumId_idx" ON "Competency"("tenantId", "curriculumId");

-- CreateIndex
CREATE INDEX "Competency_tenantId_learningAreaId_idx" ON "Competency"("tenantId", "learningAreaId");

-- CreateIndex
CREATE INDEX "Competency_tenantId_active_idx" ON "Competency"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Competency_tenantId_code_key" ON "Competency"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CompetencyEvidence_tenantId_competencyId_idx" ON "CompetencyEvidence"("tenantId", "competencyId");

-- CreateIndex
CREATE INDEX "CompetencyEvidence_tenantId_studentId_idx" ON "CompetencyEvidence"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "CompetencyEvidence_tenantId_sourceModule_sourceId_idx" ON "CompetencyEvidence"("tenantId", "sourceModule", "sourceId");

-- CreateIndex
CREATE INDEX "CompetencyEvidence_tenantId_assessmentRecordId_idx" ON "CompetencyEvidence"("tenantId", "assessmentRecordId");

-- CreateIndex
CREATE INDEX "CompetencyEvidence_tenantId_cbcAssessmentId_idx" ON "CompetencyEvidence"("tenantId", "cbcAssessmentId");

-- CreateIndex
CREATE INDEX "CompetencyEvidence_tenantId_visibleToParents_idx" ON "CompetencyEvidence"("tenantId", "visibleToParents");

