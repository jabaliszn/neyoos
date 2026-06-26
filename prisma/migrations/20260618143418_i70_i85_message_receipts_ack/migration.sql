-- CreateTable
CREATE TABLE "MessageAcknowledgement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "acknowledgedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageAcknowledgement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageAcknowledgement_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "requiresAck" BOOLEAN NOT NULL DEFAULT false,
    "urgentFallbackAt" DATETIME,
    "fallbackSmsSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("attachmentName", "attachmentUrl", "body", "conversationId", "createdAt", "id", "senderId", "senderName", "tenantId") SELECT "attachmentName", "attachmentUrl", "body", "conversationId", "createdAt", "id", "senderId", "senderName", "tenantId" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_tenantId_idx" ON "Message"("tenantId");
CREATE INDEX "Message_tenantId_urgentFallbackAt_fallbackSmsSentAt_idx" ON "Message"("tenantId", "urgentFallbackAt", "fallbackSmsSentAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MessageAcknowledgement_tenantId_userId_idx" ON "MessageAcknowledgement"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "MessageAcknowledgement_tenantId_messageId_idx" ON "MessageAcknowledgement"("tenantId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageAcknowledgement_messageId_userId_key" ON "MessageAcknowledgement"("messageId", "userId");
