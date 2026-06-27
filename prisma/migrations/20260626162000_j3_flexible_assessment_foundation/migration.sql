-- CreateTable
CREATE TABLE "AssessmentType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'SCHOOL_DEFINED',
    "scoreMode" TEXT NOT NULL DEFAULT 'MIXED',
    "defaultMaxMarks" INTEGER,
    "defaultWeight" INTEGER NOT NULL DEFAULT 0,
    "evidenceAllowed" BOOLEAN NOT NULL DEFAULT true,
    "requiresModeration" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assessmentTypeId" TEXT NOT NULL,
    "curriculumId" TEXT,
    "educationLevelId" TEXT,
    "gradeBandId" TEXT,
    "learningAreaId" TEXT,
    "subjectId" TEXT,
    "classId" TEXT,
    "academicTermId" TEXT,
    "examId" TEXT,
    "homeworkId" TEXT,
    "quizId" TEXT,
    "cbcStrandId" TEXT,
    "year" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "maxMarks" INTEGER,
    "dueDate" TEXT,
    "rubricJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "visibleToParents" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentPlan_assessmentTypeId_fkey" FOREIGN KEY ("assessmentTypeId") REFERENCES "AssessmentType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scoreMarks" REAL,
    "scorePct" INTEGER,
    "rubricLevel" INTEGER,
    "rubricCode" TEXT,
    "narrative" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceModule" TEXT,
    "sourceId" TEXT,
    "assessedById" TEXT NOT NULL,
    "assessedByName" TEXT NOT NULL,
    "assessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderatedById" TEXT,
    "moderatedByName" TEXT,
    "moderatedAt" DATETIME,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentRecord_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AssessmentPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "storedFileId" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "evidenceType" TEXT NOT NULL DEFAULT 'FILE',
    "note" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentEvidence_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AssessmentRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssessmentType_tenantId_active_idx" ON "AssessmentType"("tenantId", "active");

-- CreateIndex
CREATE INDEX "AssessmentType_tenantId_category_idx" ON "AssessmentType"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentType_tenantId_key_key" ON "AssessmentType"("tenantId", "key");

-- CreateIndex
CREATE INDEX "AssessmentPlan_tenantId_year_term_idx" ON "AssessmentPlan"("tenantId", "year", "term");

-- CreateIndex
CREATE INDEX "AssessmentPlan_tenantId_assessmentTypeId_idx" ON "AssessmentPlan"("tenantId", "assessmentTypeId");

-- CreateIndex
CREATE INDEX "AssessmentPlan_tenantId_classId_idx" ON "AssessmentPlan"("tenantId", "classId");

-- CreateIndex
CREATE INDEX "AssessmentPlan_tenantId_subjectId_idx" ON "AssessmentPlan"("tenantId", "subjectId");

-- CreateIndex
CREATE INDEX "AssessmentPlan_tenantId_learningAreaId_idx" ON "AssessmentPlan"("tenantId", "learningAreaId");

-- CreateIndex
CREATE INDEX "AssessmentPlan_tenantId_status_idx" ON "AssessmentPlan"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AssessmentRecord_tenantId_studentId_idx" ON "AssessmentRecord"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "AssessmentRecord_tenantId_planId_idx" ON "AssessmentRecord"("tenantId", "planId");

-- CreateIndex
CREATE INDEX "AssessmentRecord_tenantId_status_idx" ON "AssessmentRecord"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AssessmentRecord_tenantId_sourceModule_sourceId_idx" ON "AssessmentRecord"("tenantId", "sourceModule", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentRecord_tenantId_planId_studentId_key" ON "AssessmentRecord"("tenantId", "planId", "studentId");

-- CreateIndex
CREATE INDEX "AssessmentEvidence_tenantId_recordId_idx" ON "AssessmentEvidence"("tenantId", "recordId");

-- CreateIndex
CREATE INDEX "AssessmentEvidence_tenantId_storedFileId_idx" ON "AssessmentEvidence"("tenantId", "storedFileId");

