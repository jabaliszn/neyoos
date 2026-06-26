ALTER TABLE "Invoice" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'FEE';
CREATE INDEX "Invoice_tenantId_kind_year_term_idx" ON "Invoice"("tenantId", "kind", "year", "term");
