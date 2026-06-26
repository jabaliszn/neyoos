-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "gpsLat" REAL;
ALTER TABLE "Tenant" ADD COLUMN "gpsLng" REAL;
ALTER TABLE "Tenant" ADD COLUMN "gpsRadiusM" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StaffAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "clockInAt" DATETIME NOT NULL,
    "clockOutAt" DATETIME,
    "gpsVerified" BOOLEAN NOT NULL DEFAULT false,
    "gpsLat" REAL,
    "gpsLng" REAL,
    "gpsDistanceM" INTEGER,
    CONSTRAINT "StaffAttendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StaffAttendance" ("clockInAt", "clockOutAt", "date", "id", "role", "tenantId", "userId", "userName") SELECT "clockInAt", "clockOutAt", "date", "id", "role", "tenantId", "userId", "userName" FROM "StaffAttendance";
DROP TABLE "StaffAttendance";
ALTER TABLE "new_StaffAttendance" RENAME TO "StaffAttendance";
CREATE INDEX "StaffAttendance_tenantId_date_idx" ON "StaffAttendance"("tenantId", "date");
CREATE UNIQUE INDEX "StaffAttendance_tenantId_userId_date_key" ON "StaffAttendance"("tenantId", "userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
