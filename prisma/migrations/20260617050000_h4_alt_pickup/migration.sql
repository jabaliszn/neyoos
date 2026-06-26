-- CreateTable
CREATE TABLE "AltPickupAuthorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "pickerName" TEXT NOT NULL,
    "pickerPhone" TEXT,
    "relationship" TEXT,
    "code" TEXT NOT NULL,
    "screenshotUrl" TEXT,
    "screenshotName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "verifiedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AltPickupAuthorization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AltPickupAuthorization_tenantId_status_idx" ON "AltPickupAuthorization"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AltPickupAuthorization_tenantId_studentId_idx" ON "AltPickupAuthorization"("tenantId", "studentId");

