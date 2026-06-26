-- CreateTable
CREATE TABLE "TeacherCommsApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "audienceType" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "audienceLabel" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "body" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "bulkMessageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeacherCommsApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TeacherCommsApprovalRequest_tenantId_status_createdAt_idx" ON "TeacherCommsApprovalRequest"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherCommsApprovalRequest_tenantId_requestedById_idx" ON "TeacherCommsApprovalRequest"("tenantId", "requestedById");
