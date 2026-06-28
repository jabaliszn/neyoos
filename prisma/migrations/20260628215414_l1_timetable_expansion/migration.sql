-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TimetableConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "periodsPerDay" INTEGER NOT NULL DEFAULT 8,
    "freePeriodsPerWeek" INTEGER NOT NULL DEFAULT 4,
    "coCurricularCount" INTEGER NOT NULL DEFAULT 2,
    "coCurricularName" TEXT NOT NULL DEFAULT 'Games',
    "schoolDayStartTime" TEXT NOT NULL DEFAULT '08:00',
    "saturdayStartTime" TEXT NOT NULL DEFAULT '08:00',
    "saturdayEndTime" TEXT NOT NULL DEFAULT '12:40',
    "lessonDurationMins" INTEGER NOT NULL DEFAULT 40,
    "shortBreakStart" INTEGER NOT NULL DEFAULT 2,
    "shortBreakMins" INTEGER NOT NULL DEFAULT 15,
    "shortBreak2Start" INTEGER,
    "shortBreak2Mins" INTEGER,
    "gamesPeriodTarget" TEXT,
    "saturdayEarlyHome" BOOLEAN NOT NULL DEFAULT true,
    "longBreakStart" INTEGER NOT NULL DEFAULT 4,
    "longBreakMins" INTEGER NOT NULL DEFAULT 30,
    "lunchStart" INTEGER NOT NULL DEFAULT 6,
    "lunchMins" INTEGER NOT NULL DEFAULT 60,
    "hasRemedials" BOOLEAN NOT NULL DEFAULT false,
    "hasPreps" BOOLEAN NOT NULL DEFAULT false,
    "lunchShift" INTEGER NOT NULL DEFAULT 1,
    "hasSaturday" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "TimetableConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TimetableConfig" ("classId", "coCurricularCount", "coCurricularName", "freePeriodsPerWeek", "hasPreps", "hasRemedials", "hasSaturday", "id", "lessonDurationMins", "longBreakMins", "longBreakStart", "lunchMins", "lunchShift", "lunchStart", "periodsPerDay", "saturdayEndTime", "saturdayStartTime", "schoolDayStartTime", "shortBreakMins", "shortBreakStart", "tenantId") SELECT "classId", "coCurricularCount", "coCurricularName", "freePeriodsPerWeek", "hasPreps", "hasRemedials", "hasSaturday", "id", "lessonDurationMins", "longBreakMins", "longBreakStart", "lunchMins", "lunchShift", "lunchStart", "periodsPerDay", "saturdayEndTime", "saturdayStartTime", "schoolDayStartTime", "shortBreakMins", "shortBreakStart", "tenantId" FROM "TimetableConfig";
DROP TABLE "TimetableConfig";
ALTER TABLE "new_TimetableConfig" RENAME TO "TimetableConfig";
CREATE UNIQUE INDEX "TimetableConfig_classId_key" ON "TimetableConfig"("classId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
