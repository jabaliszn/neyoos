-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "storedFileId" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSizeBytes" INTEGER,
    "externalLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" DATETIME,
    "visibleToParents" BOOLEAN NOT NULL DEFAULT false,
    "competencyId" TEXT,
    "subjectId" TEXT,
    "clubId" TEXT,
    "awardId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortfolioItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PortfolioItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PortfolioItem_tenantId_studentId_idx" ON "PortfolioItem"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "PortfolioItem_tenantId_category_idx" ON "PortfolioItem"("tenantId", "category");

-- CreateIndex
CREATE INDEX "PortfolioItem_tenantId_status_idx" ON "PortfolioItem"("tenantId", "status");
