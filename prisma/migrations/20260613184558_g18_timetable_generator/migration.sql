-- CreateTable
CREATE TABLE "TeacherSubject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    CONSTRAINT "TeacherSubject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassSubjectNeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "lessonsPerWeek" INTEGER NOT NULL DEFAULT 5,
    CONSTRAINT "ClassSubjectNeed_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimetableConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "periodsPerDay" INTEGER NOT NULL DEFAULT 8,
    "freePeriodsPerWeek" INTEGER NOT NULL DEFAULT 4,
    "coCurricularCount" INTEGER NOT NULL DEFAULT 2,
    "coCurricularName" TEXT NOT NULL DEFAULT 'Games',
    CONSTRAINT "TimetableConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TeacherSubject_tenantId_idx" ON "TeacherSubject"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSubject_tenantId_teacherId_subjectId_key" ON "TeacherSubject"("tenantId", "teacherId", "subjectId");

-- CreateIndex
CREATE INDEX "ClassSubjectNeed_tenantId_idx" ON "ClassSubjectNeed"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubjectNeed_tenantId_classId_subjectId_key" ON "ClassSubjectNeed"("tenantId", "classId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableConfig_classId_key" ON "TimetableConfig"("classId");
