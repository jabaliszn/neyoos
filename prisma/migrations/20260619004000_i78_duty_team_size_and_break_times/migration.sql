-- I.78 refinement: school chooses number of teachers per duty reshuffle cycle
ALTER TABLE "DutyRosterEntry" ADD COLUMN "dutyTeamSize" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "DutyRosterEntry" ADD COLUMN "dutyTeacherIds" TEXT;
ALTER TABLE "DutyRosterEntry" ADD COLUMN "dutyTeacherNames" TEXT;
