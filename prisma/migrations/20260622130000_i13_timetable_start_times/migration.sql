ALTER TABLE "TimetableConfig" ADD COLUMN "schoolDayStartTime" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "TimetableConfig" ADD COLUMN "saturdayStartTime" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "TimetableConfig" ADD COLUMN "saturdayEndTime" TEXT NOT NULL DEFAULT '12:40';
