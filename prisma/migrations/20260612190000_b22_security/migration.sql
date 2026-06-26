-- CreateTable
CREATE TABLE "GatePass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "passNo" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "leaveAt" DATETIME NOT NULL,
    "returnBy" DATETIME,
    "escortName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedById" TEXT NOT NULL,
    "issuedByName" TEXT NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GatePass_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PickupPerson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "nationalId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "addedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PickupPerson_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PanicAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "note" TEXT,
    "raisedById" TEXT NOT NULL,
    "raisedByName" TEXT NOT NULL,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "smsSent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PanicAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GatePass_tenantId_status_idx" ON "GatePass"("tenantId", "status");

-- CreateIndex
CREATE INDEX "GatePass_tenantId_studentId_idx" ON "GatePass"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "GatePass_tenantId_passNo_key" ON "GatePass"("tenantId", "passNo");

-- CreateIndex
CREATE INDEX "PickupPerson_tenantId_studentId_idx" ON "PickupPerson"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "PanicAlert_tenantId_createdAt_idx" ON "PanicAlert"("tenantId", "createdAt");

