-- =====================================================================
-- NEYO — Postgres Row-Level Security policies (Feature A.2.1)
-- =====================================================================
-- DEV uses SQLite (no RLS) and relies on the application-level enforcement
-- in src/lib/core/tenant-db.ts. PRODUCTION (Neon/Postgres) should ALSO apply
-- these policies for database-enforced isolation (defense in depth).
--
-- How it works:
--   - Each request sets a session GUC:  SET app.tenant_id = '<tenantId>';
--     (do this inside withTenant via `db.$executeRaw` on Postgres).
--   - Policies restrict every row to that tenant.
--
-- Apply after migrations on Postgres:  psql "$DATABASE_URL" -f prisma/rls/policies.sql
-- Add the same block for each NEW tenant-owned table as features land
-- (Student, Invoice, AttendanceRecord, ...).
-- =====================================================================

-- Helper: read the current tenant from the session variable.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text AS $$
  SELECT current_setting('app.tenant_id', true);
$$ LANGUAGE sql STABLE;

-- ---- User -------------------------------------------------------------
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "User";
CREATE POLICY tenant_isolation ON "User"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- ---- IdSequence -------------------------------------------------------
ALTER TABLE "IdSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IdSequence" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "IdSequence";
CREATE POLICY tenant_isolation ON "IdSequence"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- ---- AuditLog (insert-only; reads scoped) -----------------------------
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
CREATE POLICY tenant_isolation ON "AuditLog"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- NOTE: a privileged "owner" role used for migrations/admin should BYPASSRLS,
-- while the application's runtime DB role must NOT, so policies always apply.
