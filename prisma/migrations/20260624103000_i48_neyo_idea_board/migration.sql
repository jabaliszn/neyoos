-- I.48 — NEYO internal idea board (company-level, not tenant-owned).
CREATE TABLE "NeyoIdea" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'IDEA',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "ownerName" TEXT,
  "linkedFeatureKey" TEXT,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "NeyoIdea_status_priority_idx" ON "NeyoIdea"("status", "priority");
CREATE INDEX "NeyoIdea_createdAt_idx" ON "NeyoIdea"("createdAt");
