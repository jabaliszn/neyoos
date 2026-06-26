-- I.60 — OAuth activation seam using NEYO Ops encrypted credential vault.
CREATE TABLE "OAuthConnectedAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "email" TEXT,
  "displayName" TEXT,
  "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" DATETIME,
  CONSTRAINT "OAuthConnectedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OAuthConnectedAccount_provider_providerAccountId_key" ON "OAuthConnectedAccount"("provider", "providerAccountId");
CREATE UNIQUE INDEX "OAuthConnectedAccount_userId_provider_key" ON "OAuthConnectedAccount"("userId", "provider");
CREATE INDEX "OAuthConnectedAccount_tenantId_idx" ON "OAuthConnectedAccount"("tenantId");

CREATE TABLE "OAuthState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "state" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "redirectTo" TEXT,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "OAuthState_state_key" ON "OAuthState"("state");
CREATE INDEX "OAuthState_userId_provider_idx" ON "OAuthState"("userId", "provider");
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");
