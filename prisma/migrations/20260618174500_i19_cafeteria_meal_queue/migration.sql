CREATE TABLE "CafeteriaQueueEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "queueNo" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "classLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "servedAt" DATETIME,
    "servedById" TEXT,
    "servedByName" TEXT,
    CONSTRAINT "CafeteriaQueueEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CafeteriaQueueEntry_tenantId_date_session_studentId_key" ON "CafeteriaQueueEntry"("tenantId", "date", "session", "studentId");
CREATE INDEX "CafeteriaQueueEntry_tenantId_date_session_status_idx" ON "CafeteriaQueueEntry"("tenantId", "date", "session", "status");
CREATE INDEX "CafeteriaQueueEntry_tenantId_studentId_idx" ON "CafeteriaQueueEntry"("tenantId", "studentId");
