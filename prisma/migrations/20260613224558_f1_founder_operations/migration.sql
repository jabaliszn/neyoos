-- CreateTable
CREATE TABLE "NeyoBuildLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shippedSummary" TEXT NOT NULL,
    "details" TEXT,
    "screenshotRefs" TEXT,
    "commitRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NeyoMetricSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodKey" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "revenueKes" INTEGER NOT NULL DEFAULT 0,
    "mrrKes" INTEGER NOT NULL DEFAULT 0,
    "payingSchools" INTEGER NOT NULL DEFAULT 0,
    "trialSchools" INTEGER NOT NULL DEFAULT 0,
    "activeSchools" INTEGER NOT NULL DEFAULT 0,
    "churnRiskSchools" INTEGER NOT NULL DEFAULT 0,
    "smsSpendKes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NeyoFounderOpsEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "scheduledFor" TEXT,
    "completedAt" DATETIME,
    "summary" TEXT,
    "notes" TEXT,
    "decisionsJson" TEXT,
    "actionItemsJson" TEXT,
    "metricsJson" TEXT,
    "audience" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NeyoCustomerInterview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactRole" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "county" TEXT,
    "interviewDate" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'CALL',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "painPointsJson" TEXT,
    "quotesJson" TEXT,
    "opportunitiesJson" TEXT,
    "followUp" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "NeyoBuildLog_dateKey_key" ON "NeyoBuildLog"("dateKey");

-- CreateIndex
CREATE INDEX "NeyoBuildLog_dateKey_idx" ON "NeyoBuildLog"("dateKey");

-- CreateIndex
CREATE INDEX "NeyoBuildLog_status_idx" ON "NeyoBuildLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NeyoMetricSnapshot_periodKey_key" ON "NeyoMetricSnapshot"("periodKey");

-- CreateIndex
CREATE INDEX "NeyoMetricSnapshot_periodStart_idx" ON "NeyoMetricSnapshot"("periodStart");

-- CreateIndex
CREATE INDEX "NeyoFounderOpsEntry_kind_status_idx" ON "NeyoFounderOpsEntry"("kind", "status");

-- CreateIndex
CREATE INDEX "NeyoFounderOpsEntry_scheduledFor_idx" ON "NeyoFounderOpsEntry"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "NeyoFounderOpsEntry_kind_periodKey_key" ON "NeyoFounderOpsEntry"("kind", "periodKey");

-- CreateIndex
CREATE INDEX "NeyoCustomerInterview_interviewDate_idx" ON "NeyoCustomerInterview"("interviewDate");

-- CreateIndex
CREATE INDEX "NeyoCustomerInterview_status_idx" ON "NeyoCustomerInterview"("status");

-- CreateIndex
CREATE INDEX "NeyoCustomerInterview_schoolName_idx" ON "NeyoCustomerInterview"("schoolName");
