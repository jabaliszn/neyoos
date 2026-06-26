-- CreateTable
CREATE TABLE "TermPulse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "weekEnd" TEXT NOT NULL,
    "activeStudents" INTEGER NOT NULL DEFAULT 0,
    "joinedThisWeek" INTEGER NOT NULL DEFAULT 0,
    "attendancePct" INTEGER NOT NULL DEFAULT 0,
    "attendancePrevPct" INTEGER NOT NULL DEFAULT 0,
    "attendanceMarked" INTEGER NOT NULL DEFAULT 0,
    "collectedWeekKes" INTEGER NOT NULL DEFAULT 0,
    "weeklyTargetKes" INTEGER NOT NULL DEFAULT 0,
    "collectionTermPct" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TermPulse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TermPulse_tenantId_createdAt_idx" ON "TermPulse"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TermPulse_tenantId_weekKey_key" ON "TermPulse"("tenantId", "weekKey");
