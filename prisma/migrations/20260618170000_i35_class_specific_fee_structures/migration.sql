-- I.35 class-specific fee structures.
ALTER TABLE "FeeStructure" ADD COLUMN "classId" TEXT;
DROP INDEX IF EXISTS "FeeStructure_tenantId_level_year_term_key";
CREATE UNIQUE INDEX "FeeStructure_tenantId_level_year_term_classId_key" ON "FeeStructure"("tenantId", "level", "year", "term", "classId");
