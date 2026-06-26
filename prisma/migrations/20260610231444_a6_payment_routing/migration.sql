-- CreateTable
CREATE TABLE "PaymentCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mpesa_daraja',
    "shortcode" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "consumerKeyEnc" TEXT,
    "consumerSecretEnc" TEXT,
    "passkeyEnc" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mpesa_daraja',
    "amount" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "accountRef" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "checkoutRequestId" TEXT,
    "mpesaRef" TEXT,
    "resultCode" TEXT,
    "resultDesc" TEXT,
    "rawCallback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCredential_tenantId_key" ON "PaymentCredential"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentCredential_tenantId_idx" ON "PaymentCredential"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_checkoutRequestId_key" ON "Payment"("checkoutRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_mpesaRef_key" ON "Payment"("mpesaRef");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
