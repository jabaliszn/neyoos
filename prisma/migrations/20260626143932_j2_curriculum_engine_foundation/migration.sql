-- CreateTable
CREATE TABLE "Curriculum" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Kenya',
    "context" TEXT,
    "activeVersion" TEXT NOT NULL DEFAULT 'v1',
    "effectiveFrom" TEXT,
    "effectiveTo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Curriculum_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EducationLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "levelKey" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EducationLevel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EducationLevel_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeBand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "educationLevelId" TEXT,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "entryAge" INTEGER,
    "exitAge" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeBand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeBand_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeBand_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearningArea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearningArea_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AcademicTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "curriculumId" TEXT,
    "year" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "current" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AcademicTerm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AcademicTerm_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AcademicTerm" ("current", "endDate", "id", "startDate", "tenantId", "term", "year") SELECT "current", "endDate", "id", "startDate", "tenantId", "term", "year" FROM "AcademicTerm";
DROP TABLE "AcademicTerm";
ALTER TABLE "new_AcademicTerm" RENAME TO "AcademicTerm";
CREATE INDEX "AcademicTerm_tenantId_curriculumId_idx" ON "AcademicTerm"("tenantId", "curriculumId");
CREATE UNIQUE INDEX "AcademicTerm_tenantId_year_term_key" ON "AcademicTerm"("tenantId", "year", "term");
CREATE TABLE "new_CbcStrand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "learningAreaId" TEXT,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "learningOutcome" TEXT,
    CONSTRAINT "CbcStrand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CbcStrand_learningAreaId_fkey" FOREIGN KEY ("learningAreaId") REFERENCES "LearningArea" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CbcStrand" ("id", "learningOutcome", "name", "subjectId", "tenantId") SELECT "id", "learningOutcome", "name", "subjectId", "tenantId" FROM "CbcStrand";
DROP TABLE "CbcStrand";
ALTER TABLE "new_CbcStrand" RENAME TO "CbcStrand";
CREATE INDEX "CbcStrand_tenantId_subjectId_idx" ON "CbcStrand"("tenantId", "subjectId");
CREATE UNIQUE INDEX "CbcStrand_tenantId_subjectId_name_key" ON "CbcStrand"("tenantId", "subjectId", "name");
CREATE TABLE "new_SchoolClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "stream" TEXT,
    "curriculum" TEXT NOT NULL DEFAULT 'CBC',
    "curriculumId" TEXT,
    "gradeBandId" TEXT,
    "classTeacherId" TEXT,
    "capacity" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolClass_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchoolClass_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SchoolClass_gradeBandId_fkey" FOREIGN KEY ("gradeBandId") REFERENCES "GradeBand" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SchoolClass" ("archived", "capacity", "classTeacherId", "createdAt", "curriculum", "id", "level", "stream", "tenantId", "updatedAt") SELECT "archived", "capacity", "classTeacherId", "createdAt", "curriculum", "id", "level", "stream", "tenantId", "updatedAt" FROM "SchoolClass";
DROP TABLE "SchoolClass";
ALTER TABLE "new_SchoolClass" RENAME TO "SchoolClass";
CREATE INDEX "SchoolClass_tenantId_idx" ON "SchoolClass"("tenantId");
CREATE INDEX "SchoolClass_tenantId_curriculumId_idx" ON "SchoolClass"("tenantId", "curriculumId");
CREATE INDEX "SchoolClass_tenantId_gradeBandId_idx" ON "SchoolClass"("tenantId", "gradeBandId");
CREATE UNIQUE INDEX "SchoolClass_tenantId_level_stream_key" ON "SchoolClass"("tenantId", "level", "stream");
CREATE TABLE "new_Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "curriculum" TEXT NOT NULL,
    "curriculumId" TEXT,
    "learningAreaId" TEXT,
    "departmentId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Subject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subject_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Subject_learningAreaId_fkey" FOREIGN KEY ("learningAreaId") REFERENCES "LearningArea" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Subject_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Subject" ("archived", "code", "curriculum", "departmentId", "id", "name", "tenantId") SELECT "archived", "code", "curriculum", "departmentId", "id", "name", "tenantId" FROM "Subject";
DROP TABLE "Subject";
ALTER TABLE "new_Subject" RENAME TO "Subject";
CREATE INDEX "Subject_tenantId_idx" ON "Subject"("tenantId");
CREATE INDEX "Subject_tenantId_curriculumId_idx" ON "Subject"("tenantId", "curriculumId");
CREATE INDEX "Subject_tenantId_learningAreaId_idx" ON "Subject"("tenantId", "learningAreaId");
CREATE UNIQUE INDEX "Subject_tenantId_code_key" ON "Subject"("tenantId", "code");
CREATE TABLE "new_SubscriptionPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL DEFAULT 'central_mpesa_stk',
    "phone" TEXT,
    "accountRef" TEXT,
    "checkoutRequestId" TEXT,
    "mpesaRef" TEXT,
    "resultCode" TEXT,
    "resultDesc" TEXT,
    "rawCallback" TEXT,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SubscriptionPayment" ("accountRef", "amount", "checkoutRequestId", "createdAt", "id", "method", "mpesaRef", "paidAt", "periodEnd", "periodStart", "phone", "rawCallback", "resultCode", "resultDesc", "status", "subscriptionId", "tenantId") SELECT "accountRef", "amount", "checkoutRequestId", "createdAt", "id", "method", "mpesaRef", "paidAt", "periodEnd", "periodStart", "phone", "rawCallback", "resultCode", "resultDesc", "status", "subscriptionId", "tenantId" FROM "SubscriptionPayment";
DROP TABLE "SubscriptionPayment";
ALTER TABLE "new_SubscriptionPayment" RENAME TO "SubscriptionPayment";
CREATE UNIQUE INDEX "SubscriptionPayment_checkoutRequestId_key" ON "SubscriptionPayment"("checkoutRequestId");
CREATE UNIQUE INDEX "SubscriptionPayment_mpesaRef_key" ON "SubscriptionPayment"("mpesaRef");
CREATE INDEX "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");
CREATE INDEX "SubscriptionPayment_tenantId_idx" ON "SubscriptionPayment"("tenantId");
CREATE INDEX "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Curriculum_tenantId_isActive_idx" ON "Curriculum"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Curriculum_tenantId_name_activeVersion_key" ON "Curriculum"("tenantId", "name", "activeVersion");

-- CreateIndex
CREATE INDEX "EducationLevel_tenantId_curriculumId_sequence_idx" ON "EducationLevel"("tenantId", "curriculumId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "EducationLevel_tenantId_curriculumId_name_key" ON "EducationLevel"("tenantId", "curriculumId", "name");

-- CreateIndex
CREATE INDEX "GradeBand_tenantId_curriculumId_sequence_idx" ON "GradeBand"("tenantId", "curriculumId", "sequence");

-- CreateIndex
CREATE INDEX "GradeBand_tenantId_educationLevelId_idx" ON "GradeBand"("tenantId", "educationLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBand_tenantId_curriculumId_name_key" ON "GradeBand"("tenantId", "curriculumId", "name");

-- CreateIndex
CREATE INDEX "LearningArea_tenantId_curriculumId_name_idx" ON "LearningArea"("tenantId", "curriculumId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LearningArea_tenantId_curriculumId_code_key" ON "LearningArea"("tenantId", "curriculumId", "code");
