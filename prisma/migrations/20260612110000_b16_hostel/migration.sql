-- AlterTable
ALTER TABLE "VisitorLog" ADD COLUMN "studentId" TEXT;

-- CreateTable
CREATE TABLE "Hostel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "masterId" TEXT,
    "boardingFeeKes" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Hostel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HostelRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    CONSTRAINT "HostelRoom_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "Hostel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HostelAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "bedNo" INTEGER NOT NULL,
    "allocatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" DATETIME,
    CONSTRAINT "HostelAllocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HostelRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HostelAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "hostelName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "markedById" TEXT NOT NULL,
    "markedByName" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HostelAttendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Hostel_tenantId_idx" ON "Hostel"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Hostel_tenantId_name_key" ON "Hostel"("tenantId", "name");

-- CreateIndex
CREATE INDEX "HostelRoom_tenantId_hostelId_idx" ON "HostelRoom"("tenantId", "hostelId");

-- CreateIndex
CREATE UNIQUE INDEX "HostelRoom_tenantId_hostelId_name_key" ON "HostelRoom"("tenantId", "hostelId", "name");

-- CreateIndex
CREATE INDEX "HostelAllocation_tenantId_roomId_idx" ON "HostelAllocation"("tenantId", "roomId");

-- CreateIndex
CREATE INDEX "HostelAllocation_tenantId_studentId_idx" ON "HostelAllocation"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "HostelAttendance_tenantId_date_idx" ON "HostelAttendance"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HostelAttendance_tenantId_studentId_date_key" ON "HostelAttendance"("tenantId", "studentId", "date");

-- CreateIndex
CREATE INDEX "VisitorLog_tenantId_studentId_idx" ON "VisitorLog"("tenantId", "studentId");

