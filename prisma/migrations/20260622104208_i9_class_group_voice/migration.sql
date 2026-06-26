-- CreateTable
CREATE TABLE "ClassVoiceRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "roomKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'DISAPPEARING',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClassVoiceRoom_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassVoiceParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    CONSTRAINT "ClassVoiceParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClassVoiceParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ClassVoiceRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassVoiceSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "fromPeerId" TEXT NOT NULL,
    "toPeerId" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "deliveredAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassVoiceSignal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClassVoiceSignal_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ClassVoiceRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassVoiceRoom_roomKey_key" ON "ClassVoiceRoom"("roomKey");

-- CreateIndex
CREATE INDEX "ClassVoiceRoom_tenantId_conversationId_status_idx" ON "ClassVoiceRoom"("tenantId", "conversationId", "status");

-- CreateIndex
CREATE INDEX "ClassVoiceRoom_tenantId_classId_status_idx" ON "ClassVoiceRoom"("tenantId", "classId", "status");

-- CreateIndex
CREATE INDEX "ClassVoiceRoom_expiresAt_idx" ON "ClassVoiceRoom"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClassVoiceParticipant_peerId_key" ON "ClassVoiceParticipant"("peerId");

-- CreateIndex
CREATE INDEX "ClassVoiceParticipant_tenantId_roomId_idx" ON "ClassVoiceParticipant"("tenantId", "roomId");

-- CreateIndex
CREATE INDEX "ClassVoiceParticipant_tenantId_userId_idx" ON "ClassVoiceParticipant"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassVoiceParticipant_roomId_userId_key" ON "ClassVoiceParticipant"("roomId", "userId");

-- CreateIndex
CREATE INDEX "ClassVoiceSignal_tenantId_roomId_toPeerId_idx" ON "ClassVoiceSignal"("tenantId", "roomId", "toPeerId");

-- CreateIndex
CREATE INDEX "ClassVoiceSignal_expiresAt_idx" ON "ClassVoiceSignal"("expiresAt");

-- CreateIndex
CREATE INDEX "ClassVoiceSignal_createdAt_idx" ON "ClassVoiceSignal"("createdAt");
