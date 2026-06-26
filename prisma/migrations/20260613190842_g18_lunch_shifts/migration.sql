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
    "lessonDurationMins" INTEGER NOT NULL DEFAULT 40,
    "shortBreakStart" INTEGER NOT NULL DEFAULT 2,
    "shortBreakMins" INTEGER NOT NULL DEFAULT 15,
    "longBreakStart" INTEGER NOT NULL DEFAULT 4,
    "longBreakMins" INTEGER NOT NULL DEFAULT 30,
    "lunchStart" INTEGER NOT NULL DEFAULT 6,
    "lunchMins" INTEGER NOT NULL DEFAULT 60,
    "hasRemedials" BOOLEAN NOT NULL DEFAULT false,
    "hasPreps" BOOLEAN NOT NULL DEFAULT false,
    "lunchShift" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "TimetableConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TimetableConfig" ("classId", "coCurricularCount", "coCurricularName", "freePeriodsPerWeek", "hasPreps", "hasRemedials", "id", "lessonDurationMins", "longBreakMins", "longBreakStart", "lunchMins", "lunchStart", "periodsPerDay", "shortBreakMins", "shortBreakStart", "tenantId") SELECT "classId", "coCurricularCount", "coCurricularName", "freePeriodsPerWeek", "hasPreps", "hasRemedials", "id", "lessonDurationMins", "longBreakMins", "longBreakStart", "lunchMins", "lunchStart", "periodsPerDay", "shortBreakMins", "shortBreakStart", "tenantId" FROM "TimetableConfig";
DROP TABLE "TimetableConfig";
ALTER TABLE "new_TimetableConfig" RENAME TO "TimetableConfig";
CREATE UNIQUE INDEX "TimetableConfig_classId_key" ON "TimetableConfig"("classId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
