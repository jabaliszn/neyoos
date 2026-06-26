-- CreateTable
CREATE TABLE "DocumentVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVerification_code_key" ON "DocumentVerification"("code");

-- CreateIndex
CREATE INDEX "DocumentVerification_tenantId_idx" ON "DocumentVerification"("tenantId");
