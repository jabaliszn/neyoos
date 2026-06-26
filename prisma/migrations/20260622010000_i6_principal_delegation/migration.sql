-- I.6 Principal Powers & Delegation: non-sensitive tasks assigned by Principal/Owner to teachers.
CREATE TABLE "PrincipalDelegationTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "assignedToId" TEXT NOT NULL,
  "assignedToName" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "assignedByName" TEXT NOT NULL,
  "dueDate" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PrincipalDelegationTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PrincipalDelegationTask_tenantId_assignedToId_status_idx" ON "PrincipalDelegationTask"("tenantId", "assignedToId", "status");
CREATE INDEX "PrincipalDelegationTask_tenantId_assignedById_createdAt_idx" ON "PrincipalDelegationTask"("tenantId", "assignedById", "createdAt");
