-- I.27 — YouTube learning inside NEYO.
CREATE TABLE "LearningVideo" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "youtubeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "channelTitle" TEXT,
  "thumbnailUrl" TEXT,
  "savedById" TEXT NOT NULL,
  "savedByName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LearningVideo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LearningVideo_tenantId_youtubeId_key" ON "LearningVideo"("tenantId", "youtubeId");
CREATE INDEX "LearningVideo_tenantId_title_idx" ON "LearningVideo"("tenantId", "title");

CREATE TABLE "LearningVideoSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "youtubeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "classId" TEXT,
  "classLabel" TEXT,
  "castCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedById" TEXT NOT NULL,
  "startedByName" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" DATETIME,
  CONSTRAINT "LearningVideoSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LearningVideoSession_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "LearningVideo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LearningVideoSession_castCode_key" ON "LearningVideoSession"("castCode");
CREATE INDEX "LearningVideoSession_tenantId_startedAt_idx" ON "LearningVideoSession"("tenantId", "startedAt");
CREATE INDEX "LearningVideoSession_tenantId_classId_idx" ON "LearningVideoSession"("tenantId", "classId");
