-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TEXT NOT NULL,
    "endDate" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "location" TEXT,
    "type" TEXT NOT NULL DEFAULT 'event',
    "audienceRole" TEXT,
    "color" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CalendarEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "county" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "curriculum" TEXT,
    "onboardedAt" DATETIME,
    "showReligiousHolidays" BOOLEAN NOT NULL DEFAULT true,
    "encryptedDek" TEXT,
    "dekIv" TEXT,
    "dekTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Tenant" ("county", "createdAt", "curriculum", "dekIv", "dekTag", "email", "encryptedDek", "id", "name", "onboardedAt", "phone", "slug", "updatedAt") SELECT "county", "createdAt", "curriculum", "dekIv", "dekTag", "email", "encryptedDek", "id", "name", "onboardedAt", "phone", "slug", "updatedAt" FROM "Tenant";
DROP TABLE "Tenant";
ALTER TABLE "new_Tenant" RENAME TO "Tenant";
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CalendarEvent_tenantId_idx" ON "CalendarEvent"("tenantId");

-- CreateIndex
CREATE INDEX "CalendarEvent_tenantId_date_idx" ON "CalendarEvent"("tenantId", "date");
