-- CreateTable
CREATE TABLE "TalentArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TalentArea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TalentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "talentAreaId" TEXT NOT NULL,
    "termId" TEXT,
    "coachId" TEXT NOT NULL,
    "score" INTEGER,
    "notes" TEXT,
    "dateRecorded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "portfolioItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TalentRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TalentRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TalentRecord_talentAreaId_fkey" FOREIGN KEY ("talentAreaId") REFERENCES "TalentArea" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TalentRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TalentRecord_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TalentArea_tenantId_name_key" ON "TalentArea"("tenantId", "name");

-- CreateIndex
CREATE INDEX "TalentRecord_tenantId_studentId_idx" ON "TalentRecord"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "TalentRecord_tenantId_talentAreaId_idx" ON "TalentRecord"("tenantId", "talentAreaId");
