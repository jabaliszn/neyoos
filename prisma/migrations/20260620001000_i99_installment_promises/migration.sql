-- I.99 installment payment plans on PromiseToPay
ALTER TABLE "PromiseToPay" ADD COLUMN "planGroupId" TEXT;
ALTER TABLE "PromiseToPay" ADD COLUMN "installmentNo" INTEGER;
ALTER TABLE "PromiseToPay" ADD COLUMN "reminderSentAt" DATETIME;
CREATE INDEX "PromiseToPay_tenantId_planGroupId_idx" ON "PromiseToPay"("tenantId", "planGroupId");
CREATE INDEX "PromiseToPay_tenantId_promiseDate_status_idx" ON "PromiseToPay"("tenantId", "promiseDate", "status");
