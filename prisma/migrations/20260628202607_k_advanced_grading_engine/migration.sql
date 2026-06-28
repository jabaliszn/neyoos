-- CreateTable
CREATE TABLE "MarksPortal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "termId" TEXT,
    "name" TEXT NOT NULL,
    "openDate" DATETIME NOT NULL,
    "closeDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "computationStartedAt" DATETIME,
    "computationEndedAt" DATETIME,
    "computationProgress" INTEGER NOT NULL DEFAULT 0,
    "computationTotalRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarksPortal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarksPortal_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TermAggregationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT,
    "subjectId" TEXT,
    "isTraditional" BOOLEAN NOT NULL DEFAULT false,
    "weightingsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TermAggregationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubjectPaperConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT,
    "name" TEXT NOT NULL,
    "outOfMarks" INTEGER NOT NULL DEFAULT 100,
    "weightPct" INTEGER NOT NULL,
    CONSTRAINT "SubjectPaperConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectPaperConfig_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "examResultId" TEXT NOT NULL,
    "paperConfigId" TEXT NOT NULL,
    "marksScored" REAL,
    CONSTRAINT "PaperResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaperResult_examResultId_fkey" FOREIGN KEY ("examResultId") REFERENCES "ExamResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaperResult_paperConfigId_fkey" FOREIGN KEY ("paperConfigId") REFERENCES "SubjectPaperConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MarksPortal_tenantId_idx" ON "MarksPortal"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TermAggregationRule_tenantId_classId_subjectId_key" ON "TermAggregationRule"("tenantId", "classId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectPaperConfig_tenantId_subjectId_classId_name_key" ON "SubjectPaperConfig"("tenantId", "subjectId", "classId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PaperResult_tenantId_examResultId_paperConfigId_key" ON "PaperResult"("tenantId", "examResultId", "paperConfigId");
