-- CreateTable
CREATE TABLE "CommunityServiceActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "location" TEXT,
    "supervisorName" TEXT,
    "supervisorPhone" TEXT,
    "studentReflection" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "proofFileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommunityServiceActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityServiceActivity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CommunityServiceActivity_tenantId_studentId_idx" ON "CommunityServiceActivity"("tenantId", "studentId");
