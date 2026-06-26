-- CreateTable
CREATE TABLE "TotpChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TotpChallenge_token_key" ON "TotpChallenge"("token");

-- CreateIndex
CREATE INDEX "TotpChallenge_userId_idx" ON "TotpChallenge"("userId");
