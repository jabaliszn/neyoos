-- I.18 — flexible cafeteria meal model and school-level meal-card scope.
ALTER TABLE "Tenant" ADD COLUMN "cafeteriaMealModel" TEXT NOT NULL DEFAULT 'HYBRID';
ALTER TABLE "Tenant" ADD COLUMN "cafeteriaMealScope" TEXT NOT NULL DEFAULT 'ALL';
