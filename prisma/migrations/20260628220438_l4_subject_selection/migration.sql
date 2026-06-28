-- CreateTable
CREATE TABLE "SubjectSelectionPortal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetLevel" TEXT NOT NULL,
    "openDate" DATETIME NOT NULL,
    "closeDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "rulesJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubjectSelectionPortal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentSubjectSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "selectedSubjectIds" TEXT NOT NULL DEFAULT '[]',
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentSubjectSelection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentSubjectSelection_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "SubjectSelectionPortal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentSubjectSelection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SubjectSelectionPortal_tenantId_idx" ON "SubjectSelectionPortal"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubjectSelection_tenantId_portalId_studentId_key" ON "StudentSubjectSelection"("tenantId", "portalId", "studentId");
