-- =====================================================================
-- NEYO — Postgres full-text search (Feature A.11) — PRODUCTION ONLY
-- =====================================================================
-- DEV uses SQLite + LIKE (src/lib/services/search.service.ts). On Postgres,
-- add generated tsvector columns + GIN indexes for fast, ranked search.
-- Apply after migrations:  psql "$DATABASE_URL" -f prisma/rls/search.sql
-- Then update search.service.ts to use to_tsquery/ts_rank for these tables.
-- Add a block per new searchable table (Student, Invoice, ...).
-- =====================================================================

-- ---- User ----
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce("fullName",'') || ' ' ||
      coalesce("email",'')    || ' ' ||
      coalesce("phone",'')    || ' ' ||
      coalesce("neyoLoginId",''))
  ) STORED;
CREATE INDEX IF NOT EXISTS user_search_idx ON "User" USING GIN (search_tsv);

-- ---- Payment ----
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce("accountRef",'')  || ' ' ||
      coalesce("phone",'')       || ' ' ||
      coalesce("mpesaRef",'')    || ' ' ||
      coalesce("description",''))
  ) STORED;
CREATE INDEX IF NOT EXISTS payment_search_idx ON "Payment" USING GIN (search_tsv);

-- Example query (tenant-scoped + ranked):
--   SELECT *, ts_rank(search_tsv, plainto_tsquery('simple', $1)) AS rank
--   FROM "User"
--   WHERE "tenantId" = $2 AND search_tsv @@ plainto_tsquery('simple', $1)
--   ORDER BY rank DESC LIMIT 5;
