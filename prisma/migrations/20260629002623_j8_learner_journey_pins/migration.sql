-- CreateTable
CREATE TABLE "LearnerJourneyPin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "entryId" TEXT NOT NULL,
    "note" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'STAFF',
    "pinnedById" TEXT NOT NULL,
    "pinnedByName" TEXT NOT NULL,
    "pinnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearnerJourneyPin_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearnerJourneyPin_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LearnerJourneyPin_tenantId_studentId_idx" ON "LearnerJourneyPin"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "LearnerJourneyPin_tenantId_sourceModule_idx" ON "LearnerJourneyPin"("tenantId", "sourceModule");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerJourneyPin_tenantId_studentId_entryId_key" ON "LearnerJourneyPin"("tenantId", "studentId", "entryId");
