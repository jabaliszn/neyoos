-- I.78 Duty-roster timetable for teachers
CREATE TABLE "DutyRosterEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "termLabel" TEXT NOT NULL,
  "rotationPeriod" TEXT NOT NULL,
  "weekNo" INTEGER NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "primaryTeacherId" TEXT NOT NULL,
  "primaryTeacherName" TEXT NOT NULL,
  "assistantTeacherId" TEXT,
  "assistantTeacherName" TEXT,
  "duties" TEXT NOT NULL,
  "generatedById" TEXT NOT NULL,
  "generatedByName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DutyRosterEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DutyRosterEntry_tenantId_termLabel_weekNo_key" ON "DutyRosterEntry"("tenantId", "termLabel", "weekNo");
CREATE INDEX "DutyRosterEntry_tenantId_termLabel_idx" ON "DutyRosterEntry"("tenantId", "termLabel");
CREATE INDEX "DutyRosterEntry_tenantId_primaryTeacherId_idx" ON "DutyRosterEntry"("tenantId", "primaryTeacherId");
