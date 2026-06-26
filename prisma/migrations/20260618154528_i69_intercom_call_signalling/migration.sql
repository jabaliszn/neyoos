-- CreateTable
CREATE TABLE "IntercomCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "callerName" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RINGING',
    "acceptedAt" DATETIME,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntercomCall_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "IntercomCall_tenantId_callerId_status_idx" ON "IntercomCall"("tenantId", "callerId", "status");

-- CreateIndex
CREATE INDEX "IntercomCall_tenantId_targetId_status_idx" ON "IntercomCall"("tenantId", "targetId", "status");
