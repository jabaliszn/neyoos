-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "Payment_deletedAt_idx" ON "Payment"("deletedAt");
