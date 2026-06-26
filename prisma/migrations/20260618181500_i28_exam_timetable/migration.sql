CREATE TABLE "ExamTimetableSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "examName" TEXT NOT NULL,
    "examDate" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "venue" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamTimetableSlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExamTimetableSlot_tenantId_classId_subjectId_examDate_startTime_key" ON "ExamTimetableSlot"("tenantId", "classId", "subjectId", "examDate", "startTime");
CREATE INDEX "ExamTimetableSlot_tenantId_examDate_idx" ON "ExamTimetableSlot"("tenantId", "examDate");
CREATE INDEX "ExamTimetableSlot_tenantId_classId_idx" ON "ExamTimetableSlot"("tenantId", "classId");
