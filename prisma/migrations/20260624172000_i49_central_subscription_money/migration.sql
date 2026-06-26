-- I.49 — Centralized NEYO subscription money and instant reconnect.
ALTER TABLE "SubscriptionPayment" ADD COLUMN "phone" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "accountRef" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "checkoutRequestId" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "resultCode" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "resultDesc" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "rawCallback" TEXT;
CREATE UNIQUE INDEX "SubscriptionPayment_checkoutRequestId_key" ON "SubscriptionPayment"("checkoutRequestId");
CREATE INDEX "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");
