-- CreateTable
CREATE TABLE "DisciplineIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "actionTaken" TEXT,
    "reportedById" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "parentNotifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisciplineIncident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Suspension" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "conditions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedById" TEXT NOT NULL,
    "issuedByName" TEXT NOT NULL,
    "parentNotifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Suspension_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CounselingNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "followUpOn" TEXT,
    "counselorId" TEXT NOT NULL,
    "counselorName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CounselingNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DisciplineIncident_tenantId_studentId_idx" ON "DisciplineIncident"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "DisciplineIncident_tenantId_date_idx" ON "DisciplineIncident"("tenantId", "date");

-- CreateIndex
CREATE INDEX "Suspension_tenantId_studentId_idx" ON "Suspension"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Suspension_tenantId_status_idx" ON "Suspension"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CounselingNote_tenantId_studentId_idx" ON "CounselingNote"("tenantId", "studentId");

