-- CreateTable
CREATE TABLE "StudentTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "destinationSchool" TEXT NOT NULL,
    "destinationCounty" TEXT,
    "transferDate" TEXT NOT NULL,
    "reason" TEXT,
    "previousClassId" TEXT,
    "letterCode" TEXT,
    "reversedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentTransfer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudentTransfer_tenantId_studentId_idx" ON "StudentTransfer"("tenantId", "studentId");
