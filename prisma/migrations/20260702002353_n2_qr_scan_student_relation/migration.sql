-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QrScanEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "detail" TEXT,
    "scannedById" TEXT NOT NULL,
    "scannedByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QrScanEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QrScanEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QrScanEvent" ("action", "createdAt", "detail", "id", "result", "scannedById", "scannedByName", "studentId", "tenantId") SELECT "action", "createdAt", "detail", "id", "result", "scannedById", "scannedByName", "studentId", "tenantId" FROM "QrScanEvent";
DROP TABLE "QrScanEvent";
ALTER TABLE "new_QrScanEvent" RENAME TO "QrScanEvent";
CREATE INDEX "QrScanEvent_tenantId_studentId_action_createdAt_idx" ON "QrScanEvent"("tenantId", "studentId", "action", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
