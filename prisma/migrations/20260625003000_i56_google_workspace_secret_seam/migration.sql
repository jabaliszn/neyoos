-- I.56 — Google Workspace storage provisioning seam: encrypted company integration secrets.
CREATE TABLE "NeyoIntegrationSecret" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "ciphertext" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "masked" TEXT,
  "updatedBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "NeyoIntegrationSecret_key_key" ON "NeyoIntegrationSecret"("key");
CREATE INDEX "NeyoIntegrationSecret_provider_idx" ON "NeyoIntegrationSecret"("provider");
