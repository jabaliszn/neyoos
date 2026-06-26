-- I.50 — Cross-cutting OS support: tenants carry their operating-system key.
ALTER TABLE "Tenant" ADD COLUMN "osKey" TEXT NOT NULL DEFAULT 'school';
CREATE INDEX "Tenant_osKey_idx" ON "Tenant"("osKey");
