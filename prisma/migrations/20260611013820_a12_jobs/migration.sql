-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" TEXT,
    "result" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "JobRun_name_idx" ON "JobRun"("name");

-- CreateIndex
CREATE INDEX "JobRun_status_idx" ON "JobRun"("status");

-- CreateIndex
CREATE INDEX "JobRun_createdAt_idx" ON "JobRun"("createdAt");
