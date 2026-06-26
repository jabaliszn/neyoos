-- I.48 — NEYO contract signing management for school onboarding.
CREATE TABLE "NeyoContract" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "schoolName" TEXT NOT NULL,
  "tenantId" TEXT,
  "contactName" TEXT NOT NULL,
  "contactRole" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "templateKey" TEXT NOT NULL DEFAULT 'SCHOOL_ONBOARDING',
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "publicToken" TEXT NOT NULL,
  "sentAt" DATETIME,
  "signedAt" DATETIME,
  "signedByName" TEXT,
  "signedByRole" TEXT,
  "signatureText" TEXT,
  "signerIp" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "NeyoContract_publicToken_key" ON "NeyoContract"("publicToken");
CREATE INDEX "NeyoContract_status_createdAt_idx" ON "NeyoContract"("status", "createdAt");
CREATE INDEX "NeyoContract_tenantId_idx" ON "NeyoContract"("tenantId");
