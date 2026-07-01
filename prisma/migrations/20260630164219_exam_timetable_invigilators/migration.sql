ALTER TABLE "ExamTimetableSlot" ADD COLUMN "paperConfigId" TEXT;
ALTER TABLE "ExamTimetableSlot" ADD COLUMN "paperName" TEXT;
ALTER TABLE "ExamTimetableSlot" ADD COLUMN "targetScope" TEXT NOT NULL DEFAULT 'CLASS';
ALTER TABLE "ExamTimetableSlot" ADD COLUMN "targetJson" TEXT DEFAULT '[]';
ALTER TABLE "ExamTimetableSlot" ADD COLUMN "invigilatorJson" TEXT DEFAULT '[]';
ALTER TABLE "ExamTimetableSlot" ADD COLUMN "warningJson" TEXT DEFAULT '[]';
