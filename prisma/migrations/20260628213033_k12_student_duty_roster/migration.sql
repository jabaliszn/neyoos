-- CreateTable
CREATE TABLE "StudentDutyArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "genderConstraint" TEXT NOT NULL DEFAULT 'MIXED',
    "targetClassIds" TEXT NOT NULL DEFAULT '[]',
    "maxStudents" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "StudentDutyArea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentDutyAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dutyAreaId" TEXT NOT NULL,
    "termId" TEXT,
    "assignedById" TEXT NOT NULL,
    "assignedByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentDutyAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentDutyAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentDutyAssignment_dutyAreaId_fkey" FOREIGN KEY ("dutyAreaId") REFERENCES "StudentDutyArea" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentDutyAssignment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentDutyArea_tenantId_name_key" ON "StudentDutyArea"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDutyAssignment_tenantId_studentId_termId_key" ON "StudentDutyAssignment"("tenantId", "studentId", "termId");
