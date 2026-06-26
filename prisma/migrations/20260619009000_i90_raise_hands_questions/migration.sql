-- I.90 Raise hand / ask question during online class
CREATE TABLE "OnlineClassQuestion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "peerId" TEXT NOT NULL,
  "studentName" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedByName" TEXT,
  "approvedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnlineClassQuestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OnlineClassQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OnlineClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OnlineClassQuestion_tenantId_sessionId_status_idx" ON "OnlineClassQuestion"("tenantId", "sessionId", "status");
CREATE INDEX "OnlineClassQuestion_tenantId_userId_idx" ON "OnlineClassQuestion"("tenantId", "userId");
