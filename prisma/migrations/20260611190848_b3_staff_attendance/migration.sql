-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "clockInAt" DATETIME NOT NULL,
    "clockOutAt" DATETIME,
    CONSTRAINT "StaffAttendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StaffAttendance_tenantId_date_idx" ON "StaffAttendance"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_tenantId_userId_date_key" ON "StaffAttendance"("tenantId", "userId", "date");
