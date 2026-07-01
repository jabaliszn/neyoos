-- CreateTable
CREATE TABLE "MasterReportCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT,
    "finalMark" REAL NOT NULL,
    "cbcLevel" INTEGER,
    "letterGrade" TEXT,
    "rank" INTEGER,
    "outOf" INTEGER,
    "isTraditional" BOOLEAN NOT NULL DEFAULT false,
    "componentsJson" TEXT NOT NULL DEFAULT '[]',
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MasterReportCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MasterReportCard_tenantId_termId_classId_idx" ON "MasterReportCard"("tenantId", "termId", "classId");

-- CreateIndex
CREATE INDEX "MasterReportCard_tenantId_studentId_idx" ON "MasterReportCard"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterReportCard_tenantId_termId_studentId_subjectId_key" ON "MasterReportCard"("tenantId", "termId", "studentId", "subjectId");
