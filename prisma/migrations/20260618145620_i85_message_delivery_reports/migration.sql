-- CreateTable
CREATE TABLE "MessageDeliveryReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "readCount" INTEGER NOT NULL,
    "ackCount" INTEGER NOT NULL,
    "unreadCount" INTEGER NOT NULL,
    "smsFallbackSentCount" INTEGER NOT NULL DEFAULT 0,
    "unreadJson" TEXT,
    "summary" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" DATETIME,
    CONSTRAINT "MessageDeliveryReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageDeliveryReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageDeliveryReport_messageId_key" ON "MessageDeliveryReport"("messageId");

-- CreateIndex
CREATE INDEX "MessageDeliveryReport_tenantId_senderId_generatedAt_idx" ON "MessageDeliveryReport"("tenantId", "senderId", "generatedAt");

-- CreateIndex
CREATE INDEX "MessageDeliveryReport_tenantId_conversationId_idx" ON "MessageDeliveryReport"("tenantId", "conversationId");
