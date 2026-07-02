-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SubscriptionPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "referralDiscountKes" INTEGER NOT NULL DEFAULT 0,
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
