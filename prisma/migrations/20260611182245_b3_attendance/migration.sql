-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "smsSentAt" DATETIME,
    "markedById" TEXT NOT NULL,
    "markedByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AttendanceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_classId_date_idx" ON "AttendanceRecord"("tenantId", "classId", "date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_date_idx" ON "AttendanceRecord"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_tenantId_studentId_date_key" ON "AttendanceRecord"("tenantId", "studentId", "date");
