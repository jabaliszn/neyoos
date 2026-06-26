-- CreateTable
CREATE TABLE "StudentMedical" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bloodGroup" TEXT,
    "conditions" TEXT,
    "allergies" TEXT,
    "shaNumber" TEXT,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentMedical_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "complaint" TEXT NOT NULL,
    "treatment" TEXT NOT NULL,
    "medicationGiven" TEXT,
    "referredTo" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "parentNotifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClinicVisit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicationPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "drug" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicationPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicationDose" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "givenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "MedicationDose_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MedicationPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentMedical_studentId_key" ON "StudentMedical"("studentId");

-- CreateIndex
CREATE INDEX "StudentMedical_tenantId_idx" ON "StudentMedical"("tenantId");

-- CreateIndex
CREATE INDEX "ClinicVisit_tenantId_studentId_idx" ON "ClinicVisit"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "ClinicVisit_tenantId_date_idx" ON "ClinicVisit"("tenantId", "date");

-- CreateIndex
CREATE INDEX "MedicationPlan_tenantId_studentId_idx" ON "MedicationPlan"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "MedicationDose_tenantId_planId_idx" ON "MedicationDose"("tenantId", "planId");

