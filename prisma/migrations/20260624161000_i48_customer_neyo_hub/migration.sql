-- I.48 — Customer ↔ NEYO communication hub.
CREATE TABLE "NeyoCustomerThread" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT,
  "schoolName" TEXT NOT NULL,
  "contactUserId" TEXT,
  "contactName" TEXT NOT NULL,
  "contactRole" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "source" TEXT NOT NULL DEFAULT 'SCHOOL_OS',
  "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "NeyoCustomerThread_tenantId_status_idx" ON "NeyoCustomerThread"("tenantId", "status");
CREATE INDEX "NeyoCustomerThread_status_priority_lastMessageAt_idx" ON "NeyoCustomerThread"("status", "priority", "lastMessageAt");

CREATE TABLE "NeyoCustomerMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "threadId" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'CUSTOMER',
  "body" TEXT NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT NOT NULL,
  "authorRole" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'IN_APP',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NeyoCustomerMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "NeyoCustomerThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NeyoCustomerMessage_threadId_createdAt_idx" ON "NeyoCustomerMessage"("threadId", "createdAt");
CREATE INDEX "NeyoCustomerMessage_direction_createdAt_idx" ON "NeyoCustomerMessage"("direction", "createdAt");
