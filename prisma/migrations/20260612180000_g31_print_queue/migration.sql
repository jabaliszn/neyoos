-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "classId" TEXT,
    "classLabel" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "queuedBy" TEXT NOT NULL,
    "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedAt" DATETIME,
    CONSTRAINT "PrintJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PrintJob_tenantId_status_idx" ON "PrintJob"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PrintJob_tenantId_classId_idx" ON "PrintJob"("tenantId", "classId");

