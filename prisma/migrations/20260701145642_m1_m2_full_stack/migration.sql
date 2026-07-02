-- CreateTable
CREATE TABLE "ReferralCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "counterpartTenantId" TEXT NOT NULL,
    "counterpartName" TEXT NOT NULL,
    "discountPct" REAL NOT NULL,
    "triggerPaymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "appliedToPaymentId" TEXT,
    "appliedAmountKes" INTEGER,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReferralCredit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCredit_triggerPaymentId_key" ON "ReferralCredit"("triggerPaymentId");

-- CreateIndex
CREATE INDEX "ReferralCredit_tenantId_status_idx" ON "ReferralCredit"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ReferralCredit_counterpartTenantId_idx" ON "ReferralCredit"("counterpartTenantId");
