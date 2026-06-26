-- CreateTable
CREATE TABLE "BulkMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "audienceType" TEXT NOT NULL,
    "classId" TEXT,
    "audienceLabel" TEXT NOT NULL,
    "role" TEXT,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "sentCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "costKes" REAL NOT NULL DEFAULT 0,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BulkMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BulkMessage_tenantId_createdAt_idx" ON "BulkMessage"("tenantId", "createdAt");
