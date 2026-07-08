-- CreateTable
CREATE TABLE "SubstituteAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "timetableSlotId" TEXT NOT NULL,
    "originalTeacherId" TEXT NOT NULL,
    "originalTeacherName" TEXT NOT NULL,
    "substituteTeacherId" TEXT,
    "substituteTeacherName" TEXT,
    "coverageDates" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "confirmedById" TEXT,
    "confirmedByName" TEXT,
    "confirmedAt" DATETIME,
    "declineReason" TEXT,
    "revertedById" TEXT,
    "revertedByName" TEXT,
    "revertedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubstituteAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SubstituteAssignment_tenantId_leaveRequestId_idx" ON "SubstituteAssignment"("tenantId", "leaveRequestId");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_tenantId_timetableSlotId_idx" ON "SubstituteAssignment"("tenantId", "timetableSlotId");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_tenantId_status_idx" ON "SubstituteAssignment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_tenantId_substituteTeacherId_idx" ON "SubstituteAssignment"("tenantId", "substituteTeacherId");
