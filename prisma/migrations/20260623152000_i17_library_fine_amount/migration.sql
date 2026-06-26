-- I.17 — customizable library late-return fine amount.
ALTER TABLE "Tenant" ADD COLUMN "libraryFinePerDayKes" INTEGER NOT NULL DEFAULT 10;
