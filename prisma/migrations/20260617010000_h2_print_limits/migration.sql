-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "printLimitPerDay" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "PrintApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "docKind" TEXT NOT NULL,
    "docRef" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PrintApprovalRequest_tenantId_status_idx" ON "PrintApprovalRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PrintApprovalRequest_tenantId_requestedById_status_idx" ON "PrintApprovalRequest"("tenantId", "requestedById", "status");

