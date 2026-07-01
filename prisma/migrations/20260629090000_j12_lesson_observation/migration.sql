-- CreateTable: J.12 — observations recorded directly from a lesson plan.
CREATE TABLE "LessonObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "lessonPlanId" TEXT NOT NULL,
    "studentId" TEXT,
    "strandId" TEXT,
    "competencyId" TEXT,
    "level" INTEGER,
    "note" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonObservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonObservation_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "LessonPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LessonObservation_tenantId_lessonPlanId_idx" ON "LessonObservation"("tenantId", "lessonPlanId");
CREATE INDEX "LessonObservation_tenantId_studentId_idx" ON "LessonObservation"("tenantId", "studentId");
