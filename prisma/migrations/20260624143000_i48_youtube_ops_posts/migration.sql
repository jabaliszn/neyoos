-- I.48/I.51 — NEYO Ops YouTube management and posting calendar.
-- Company-level posting records, deliberately not tenant-owned; access is SUPER_ADMIN via Founder Ops.
CREATE TABLE "NeyoYoutubePost" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "youtubeUrlOrId" TEXT,
  "youtubeId" TEXT,
  "caption" TEXT NOT NULL,
  "audience" TEXT NOT NULL DEFAULT 'SCHOOLS',
  "channel" TEXT NOT NULL DEFAULT 'NEYO_YOUTUBE',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "scheduledFor" DATETIME,
  "postedUrl" TEXT,
  "ownerName" TEXT,
  "schoolTenantId" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "NeyoYoutubePost_status_scheduledFor_idx" ON "NeyoYoutubePost"("status", "scheduledFor");
CREATE INDEX "NeyoYoutubePost_createdAt_idx" ON "NeyoYoutubePost"("createdAt");
CREATE INDEX "NeyoYoutubePost_schoolTenantId_idx" ON "NeyoYoutubePost"("schoolTenantId");
