ALTER TABLE "ExamTimetableSlot" ADD COLUMN "invigilatorScope" TEXT NOT NULL DEFAULT 'AUTO';
ALTER TABLE "ExamTimetableSlot" ADD COLUMN "eligibleInvigilatorJson" TEXT DEFAULT '[]';
