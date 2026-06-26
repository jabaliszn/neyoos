-- CreateTable
CREATE TABLE "VisitorLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "idNumber" TEXT,
    "purpose" TEXT NOT NULL,
    "host" TEXT,
    "badgeNo" TEXT NOT NULL,
    "signedInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedOutAt" DATETIME,
    "createdById" TEXT,
    CONSTRAINT "VisitorLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdmissionInquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "studentName" TEXT,
    "gradeWanted" TEXT,
    "curriculum" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionInquiry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhoneMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "callerName" TEXT NOT NULL,
    "callerPhone" TEXT,
    "forUserId" TEXT NOT NULL,
    "forUserName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "conversationId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhoneMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VisitorLog_tenantId_idx" ON "VisitorLog"("tenantId");

-- CreateIndex
CREATE INDEX "VisitorLog_tenantId_signedInAt_idx" ON "VisitorLog"("tenantId", "signedInAt");

-- CreateIndex
CREATE INDEX "AdmissionInquiry_tenantId_idx" ON "AdmissionInquiry"("tenantId");

-- CreateIndex
CREATE INDEX "AdmissionInquiry_tenantId_status_idx" ON "AdmissionInquiry"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PhoneMessage_tenantId_idx" ON "PhoneMessage"("tenantId");

-- CreateIndex
CREATE INDEX "PhoneMessage_tenantId_createdAt_idx" ON "PhoneMessage"("tenantId", "createdAt");
