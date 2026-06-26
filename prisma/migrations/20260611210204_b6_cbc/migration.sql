-- CreateTable
CREATE TABLE "CbcStrand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "learningOutcome" TEXT,
    CONSTRAINT "CbcStrand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CbcAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "strandId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "comment" TEXT,
    "date" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CbcAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CbcAssessment_strandId_fkey" FOREIGN KEY ("strandId") REFERENCES "CbcStrand" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CbcStrand_tenantId_subjectId_idx" ON "CbcStrand"("tenantId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "CbcStrand_tenantId_subjectId_name_key" ON "CbcStrand"("tenantId", "subjectId", "name");

-- CreateIndex
CREATE INDEX "CbcAssessment_tenantId_studentId_idx" ON "CbcAssessment"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "CbcAssessment_tenantId_strandId_date_idx" ON "CbcAssessment"("tenantId", "strandId", "date");
