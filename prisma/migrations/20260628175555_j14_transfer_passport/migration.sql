-- CreateTable
CREATE TABLE "TransferPassportRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceTenantId" TEXT NOT NULL,
    "destinationTenantId" TEXT,
    "destinationEmail" TEXT,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "includedModules" TEXT NOT NULL,
    "consentBy" TEXT NOT NULL,
    "consentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransferPassportRequest_sourceTenantId_fkey" FOREIGN KEY ("sourceTenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransferPassportRequest_destinationTenantId_fkey" FOREIGN KEY ("destinationTenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransferPassportRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TransferPassportRequest_accessCode_key" ON "TransferPassportRequest"("accessCode");

-- CreateIndex
CREATE INDEX "TransferPassportRequest_sourceTenantId_idx" ON "TransferPassportRequest"("sourceTenantId");

-- CreateIndex
CREATE INDEX "TransferPassportRequest_destinationTenantId_idx" ON "TransferPassportRequest"("destinationTenantId");

-- CreateIndex
CREATE INDEX "TransferPassportRequest_studentId_idx" ON "TransferPassportRequest"("studentId");
