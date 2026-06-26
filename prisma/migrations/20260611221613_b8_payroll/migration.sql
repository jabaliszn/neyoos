-- CreateTable
CREATE TABLE "StaffSalary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "basicKes" INTEGER NOT NULL,
    "houseAllowanceKes" INTEGER NOT NULL DEFAULT 0,
    "transportAllowanceKes" INTEGER NOT NULL DEFAULT 0,
    "otherAllowanceKes" INTEGER NOT NULL DEFAULT 0,
    "saccoKes" INTEGER NOT NULL DEFAULT 0,
    "loanKes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffSalary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "basicKes" INTEGER NOT NULL,
    "allowancesKes" INTEGER NOT NULL,
    "overtimeKes" INTEGER NOT NULL DEFAULT 0,
    "grossKes" INTEGER NOT NULL,
    "payeKes" INTEGER NOT NULL,
    "shifKes" INTEGER NOT NULL,
    "nssfKes" INTEGER NOT NULL,
    "housingLevyKes" INTEGER NOT NULL,
    "saccoKes" INTEGER NOT NULL,
    "loanKes" INTEGER NOT NULL,
    "netKes" INTEGER NOT NULL,
    CONSTRAINT "Payslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffSalary_userId_key" ON "StaffSalary"("userId");

-- CreateIndex
CREATE INDEX "StaffSalary_tenantId_idx" ON "StaffSalary"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_tenantId_period_key" ON "PayrollRun"("tenantId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_runId_userId_key" ON "Payslip"("runId", "userId");
