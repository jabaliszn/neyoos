-- CreateTable
CREATE TABLE "ActivityCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "description" TEXT,
    "maxPerWeek" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TimetableSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT,
    "activityCategoryId" TEXT,
    "teacherId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "slotType" TEXT NOT NULL DEFAULT 'ACADEMIC',
    "weekRotation" TEXT NOT NULL DEFAULT 'ALL',
    "venue" TEXT,
    CONSTRAINT "TimetableSlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_activityCategoryId_fkey" FOREIGN KEY ("activityCategoryId") REFERENCES "ActivityCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TimetableSlot" ("classId", "dayOfWeek", "id", "period", "slotType", "subjectId", "teacherId", "tenantId", "venue", "weekRotation") SELECT "classId", "dayOfWeek", "id", "period", "slotType", "subjectId", "teacherId", "tenantId", "venue", "weekRotation" FROM "TimetableSlot";
DROP TABLE "TimetableSlot";
ALTER TABLE "new_TimetableSlot" RENAME TO "TimetableSlot";
CREATE INDEX "TimetableSlot_tenantId_teacherId_dayOfWeek_period_idx" ON "TimetableSlot"("tenantId", "teacherId", "dayOfWeek", "period");
CREATE UNIQUE INDEX "TimetableSlot_tenantId_classId_dayOfWeek_period_slotType_key" ON "TimetableSlot"("tenantId", "classId", "dayOfWeek", "period", "slotType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCategory_tenantId_name_key" ON "ActivityCategory"("tenantId", "name");
