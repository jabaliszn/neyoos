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
    CONSTRAINT "TimetableConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TimetableConfig" ("classId", "coCurricularCount", "coCurricularName", "freePeriodsPerWeek", "id", "periodsPerDay", "tenantId") SELECT "classId", "coCurricularCount", "coCurricularName", "freePeriodsPerWeek", "id", "periodsPerDay", "tenantId" FROM "TimetableConfig";
DROP TABLE "TimetableConfig";
ALTER TABLE "new_TimetableConfig" RENAME TO "TimetableConfig";
CREATE UNIQUE INDEX "TimetableConfig_classId_key" ON "TimetableConfig"("classId");
CREATE TABLE "new_TimetableSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "slotType" TEXT NOT NULL DEFAULT 'ACADEMIC',
    CONSTRAINT "TimetableSlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TimetableSlot" ("classId", "dayOfWeek", "id", "period", "subjectId", "teacherId", "tenantId") SELECT "classId", "dayOfWeek", "id", "period", "subjectId", "teacherId", "tenantId" FROM "TimetableSlot";
DROP TABLE "TimetableSlot";
ALTER TABLE "new_TimetableSlot" RENAME TO "TimetableSlot";
CREATE INDEX "TimetableSlot_tenantId_teacherId_dayOfWeek_period_idx" ON "TimetableSlot"("tenantId", "teacherId", "dayOfWeek", "period");
CREATE UNIQUE INDEX "TimetableSlot_tenantId_classId_dayOfWeek_period_slotType_key" ON "TimetableSlot"("tenantId", "classId", "dayOfWeek", "period", "slotType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
