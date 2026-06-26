-- I.90 Online meeting controls for live classes
ALTER TABLE "OnlineClassSession" ADD COLUMN "muteAllStudents" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnlineClassSession" ADD COLUMN "studentVideoDisabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnlineClassSession" ADD COLUMN "screenSharePeerId" TEXT;
ALTER TABLE "OnlineClassSession" ADD COLUMN "recordingAllowed" BOOLEAN NOT NULL DEFAULT false;
