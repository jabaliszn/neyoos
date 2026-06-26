-- I.89 WebRTC Online Live Classes
CREATE TABLE "OnlineClassSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "teacherName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "scheduledAt" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "roomId" TEXT NOT NULL,
  "joinUrl" TEXT NOT NULL,
  "tvAccessCode" TEXT NOT NULL,
  "startedAt" DATETIME,
  "endedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OnlineClassSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OnlineClassSession_roomId_key" ON "OnlineClassSession"("roomId");
CREATE INDEX "OnlineClassSession_tenantId_classId_status_idx" ON "OnlineClassSession"("tenantId", "classId", "status");
CREATE INDEX "OnlineClassSession_tenantId_teacherId_idx" ON "OnlineClassSession"("tenantId", "teacherId");
