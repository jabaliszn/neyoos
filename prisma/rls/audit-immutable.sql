-- =====================================================================
-- NEYO — Immutable Audit Log (Feature A.14) — PRODUCTION (Postgres)
-- =====================================================================
-- App code already only INSERTs into "AuditLog" (verified). On Postgres, also
-- enforce immutability at the database so even a compromised app/role can't
-- alter or erase history. Apply after migrations:
--   psql "$DATABASE_URL" -f prisma/rls/audit-immutable.sql
-- SQLite (dev) has no such trigger; immutability there is by app discipline.
-- =====================================================================

CREATE OR REPLACE FUNCTION neyo_block_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_update ON "AuditLog";
CREATE TRIGGER audit_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION neyo_block_audit_mutation();

DROP TRIGGER IF EXISTS audit_no_delete ON "AuditLog";
CREATE TRIGGER audit_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION neyo_block_audit_mutation();

-- Retention: archive (don't delete) rows older than policy to cold storage via
-- a scheduled export, since deletes are blocked. See A.12 jobs for scheduling.
