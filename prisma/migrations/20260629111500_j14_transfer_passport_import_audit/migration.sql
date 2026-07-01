ALTER TABLE "TransferPassportRequest" ADD COLUMN "importedAt" DATETIME;
ALTER TABLE "TransferPassportRequest" ADD COLUMN "receivedById" TEXT;
ALTER TABLE "TransferPassportRequest" ADD COLUMN "receivedByName" TEXT;
ALTER TABLE "TransferPassportRequest" ADD COLUMN "lastAccessedAt" DATETIME;
CREATE INDEX "TransferPassportRequest_status_idx" ON "TransferPassportRequest"("status");
