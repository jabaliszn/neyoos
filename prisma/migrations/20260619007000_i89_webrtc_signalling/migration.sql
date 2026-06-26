-- I.89 WebRTC signalling for online live classes
CREATE TABLE "OnlineClassParticipant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "peerId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnlineClassParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OnlineClassParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OnlineClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OnlineClassParticipant_peerId_key" ON "OnlineClassParticipant"("peerId");
CREATE INDEX "OnlineClassParticipant_tenantId_sessionId_idx" ON "OnlineClassParticipant"("tenantId", "sessionId");
CREATE INDEX "OnlineClassParticipant_tenantId_userId_idx" ON "OnlineClassParticipant"("tenantId", "userId");

CREATE TABLE "OnlineClassSignal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "fromPeerId" TEXT NOT NULL,
  "toPeerId" TEXT,
  "type" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "deliveredAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnlineClassSignal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OnlineClassSignal_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OnlineClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OnlineClassSignal_tenantId_sessionId_toPeerId_idx" ON "OnlineClassSignal"("tenantId", "sessionId", "toPeerId");
CREATE INDEX "OnlineClassSignal_createdAt_idx" ON "OnlineClassSignal"("createdAt");
