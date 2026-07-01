DROP INDEX IF EXISTS "ExamTimetableSlot_tenantId_classId_subjectId_examDate_startTime_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ExamTimetableSlot_tenantId_classId_subjectId_examDate_startTime_paperName_key"
ON "ExamTimetableSlot"("tenantId", "classId", "subjectId", "examDate", "startTime", "paperName");
