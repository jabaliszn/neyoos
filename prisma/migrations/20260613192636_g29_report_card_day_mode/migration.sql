-- CreateTable
CREATE TABLE "ReportCardDayCheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianName" TEXT NOT NULL,
    "queueNo" INTEGER NOT NULL,
    "checkedInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    CONSTRAINT "ReportCardDayCheckIn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReportCardDayCheckIn_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReportCardDayCheckIn_tenantId_idx" ON "ReportCardDayCheckIn"("tenantId");

-- CreateIndex
CREATE INDEX "ReportCardDayCheckIn_studentId_idx" ON "ReportCardDayCheckIn"("studentId");
