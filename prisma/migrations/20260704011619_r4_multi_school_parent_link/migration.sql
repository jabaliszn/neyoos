-- CreateTable
CREATE TABLE "LinkedGuardianAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "primaryUserId" TEXT NOT NULL,
    "linkedUserId" TEXT NOT NULL,
    "verifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LinkedGuardianAccount_primaryUserId_fkey" FOREIGN KEY ("primaryUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LinkedGuardianAccount_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LinkedGuardianAccount_primaryUserId_idx" ON "LinkedGuardianAccount"("primaryUserId");

-- CreateIndex
CREATE INDEX "LinkedGuardianAccount_linkedUserId_idx" ON "LinkedGuardianAccount"("linkedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedGuardianAccount_primaryUserId_linkedUserId_key" ON "LinkedGuardianAccount"("primaryUserId", "linkedUserId");
