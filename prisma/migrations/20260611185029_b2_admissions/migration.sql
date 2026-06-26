-- CreateTable
CREATE TABLE "AdmissionApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "gradeWanted" TEXT NOT NULL,
    "curriculum" TEXT,
    "previousSchool" TEXT,
    "guardianName" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,
    "guardianEmail" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'online',
    "interviewDate" TEXT,
    "interviewTime" TEXT,
    "interviewNote" TEXT,
    "calendarEventId" TEXT,
    "depositRequiredKes" INTEGER NOT NULL DEFAULT 0,
    "depositPaidKes" INTEGER NOT NULL DEFAULT 0,
    "depositPaidAt" DATETIME,
    "depositRef" TEXT,
    "decisionNote" TEXT,
    "letterCode" TEXT,
    "studentId" TEXT,
    "inquiryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdmissionApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_studentId_key" ON "AdmissionApplication"("studentId");

-- CreateIndex
CREATE INDEX "AdmissionApplication_tenantId_status_idx" ON "AdmissionApplication"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AdmissionApplication_tenantId_createdAt_idx" ON "AdmissionApplication"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_tenantId_applicationNo_key" ON "AdmissionApplication"("tenantId", "applicationNo");
