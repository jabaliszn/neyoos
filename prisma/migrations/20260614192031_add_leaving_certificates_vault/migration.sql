-- CreateTable
CREATE TABLE "LeavingCertificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "certificateNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STORED',
    "fileUrl" TEXT,
    "fileName" TEXT,
    "handedOverTo" TEXT,
    "handedOverAt" DATETIME,
    "handedOverById" TEXT,
    "handedOverByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeavingCertificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LeavingCertificate_studentId_key" ON "LeavingCertificate"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LeavingCertificate_certificateNo_key" ON "LeavingCertificate"("certificateNo");

-- CreateIndex
CREATE INDEX "LeavingCertificate_tenantId_idx" ON "LeavingCertificate"("tenantId");
