-- CreateTable
CREATE TABLE "SchoolActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountKes" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "eventDate" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolActivityClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    CONSTRAINT "SchoolActivityClass_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "SchoolActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_PAID',
    "invoiceId" TEXT,
    "waivedReason" TEXT,
    "waivedById" TEXT,
    "waivedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "SchoolActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SchoolActivity_tenantId_idx" ON "SchoolActivity"("tenantId");

-- CreateIndex
CREATE INDEX "SchoolActivity_tenantId_year_term_idx" ON "SchoolActivity"("tenantId", "year", "term");

-- CreateIndex
CREATE INDEX "SchoolActivityClass_tenantId_idx" ON "SchoolActivityClass"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolActivityClass_activityId_classId_key" ON "SchoolActivityClass"("activityId", "classId");

-- CreateIndex
CREATE INDEX "ActivityParticipant_tenantId_idx" ON "ActivityParticipant"("tenantId");

-- CreateIndex
CREATE INDEX "ActivityParticipant_tenantId_status_idx" ON "ActivityParticipant"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityParticipant_activityId_studentId_key" ON "ActivityParticipant"("activityId", "studentId");
