-- CreateTable
CREATE TABLE "SkillsPassportEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillArea" TEXT NOT NULL,
    "ratingLevel" INTEGER NOT NULL,
    "evidenceSource" TEXT NOT NULL,
    "sourceId" TEXT,
    "narrative" TEXT,
    "evidenceDate" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SkillsPassportEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillsPassportEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SkillsPassportEntry_tenantId_studentId_idx" ON "SkillsPassportEntry"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "SkillsPassportEntry_tenantId_skillArea_idx" ON "SkillsPassportEntry"("tenantId", "skillArea");

-- CreateIndex
CREATE INDEX "SkillsPassportEntry_tenantId_evidenceSource_idx" ON "SkillsPassportEntry"("tenantId", "evidenceSource");
