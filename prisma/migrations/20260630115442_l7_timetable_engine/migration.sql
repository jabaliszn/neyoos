-- AlterTable: ClassSubjectNeed double-lesson support
ALTER TABLE "ClassSubjectNeed" ADD COLUMN "doubleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ClassSubjectNeed" ADD COLUMN "allowSplitDouble" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable CombinationGroup
CREATE TABLE "CombinationGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "lessonsPerWeek" INTEGER NOT NULL DEFAULT 4,
    "doubleCount" INTEGER NOT NULL DEFAULT 0,
    "scope" TEXT NOT NULL DEFAULT 'SELECTED',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CombinationGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CombinationGroup_tenantId_idx" ON "CombinationGroup"("tenantId");

-- CreateTable CombinationGroupClass
CREATE TABLE "CombinationGroupClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    CONSTRAINT "CombinationGroupClass_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CombinationGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CombinationGroupClass_groupId_classId_key" ON "CombinationGroupClass"("groupId", "classId");
CREATE INDEX "CombinationGroupClass_tenantId_idx" ON "CombinationGroupClass"("tenantId");

-- CreateTable TimetableConstraint
CREATE TABLE "TimetableConstraint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isHard" BOOLEAN NOT NULL DEFAULT false,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableConstraint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TimetableConstraint_tenantId_kind_idx" ON "TimetableConstraint"("tenantId", "kind");

-- CreateTable TeacherTimeOff
CREATE TABLE "TeacherTimeOff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "note" TEXT,
    CONSTRAINT "TeacherTimeOff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TeacherTimeOff_tenantId_teacherId_idx" ON "TeacherTimeOff"("tenantId", "teacherId");

-- CreateTable TimetableGenerationJob
CREATE TABLE "TimetableGenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "phase" TEXT NOT NULL DEFAULT 'Queued',
    "slotsPlaced" INTEGER NOT NULL DEFAULT 0,
    "unplacedJson" TEXT NOT NULL DEFAULT '[]',
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "startedById" TEXT NOT NULL,
    "startedByName" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "TimetableGenerationJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TimetableGenerationJob_tenantId_status_idx" ON "TimetableGenerationJob"("tenantId", "status");
