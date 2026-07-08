-- CreateTable
CREATE TABLE "StudentNationalAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "milestone" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "indexNo" TEXT,
    "overallScorePct" INTEGER,
    "overallGrade" TEXT,
    "subjectsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentNationalAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentNationalAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudentNationalAssessment_tenantId_studentId_idx" ON "StudentNationalAssessment"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "StudentNationalAssessment_tenantId_milestone_idx" ON "StudentNationalAssessment"("tenantId", "milestone");

-- CreateIndex
CREATE UNIQUE INDEX "StudentNationalAssessment_tenantId_studentId_milestone_year_key" ON "StudentNationalAssessment"("tenantId", "studentId", "milestone", "year");
