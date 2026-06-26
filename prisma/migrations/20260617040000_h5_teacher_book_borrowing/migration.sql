-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BookIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "borrowerType" TEXT NOT NULL DEFAULT 'STUDENT',
    "studentId" TEXT,
    "borrowerUserId" TEXT,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL DEFAULT '',
    "issuedById" TEXT NOT NULL,
    "issuedByName" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TEXT NOT NULL,
    "returnedAt" DATETIME,
    "fineKes" INTEGER NOT NULL DEFAULT 0,
    "finePaid" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "BookIssue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookIssue_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BookIssue" ("admissionNo", "bookId", "dueDate", "fineKes", "finePaid", "id", "issuedAt", "issuedById", "issuedByName", "returnedAt", "studentId", "studentName", "tenantId") SELECT "admissionNo", "bookId", "dueDate", "fineKes", "finePaid", "id", "issuedAt", "issuedById", "issuedByName", "returnedAt", "studentId", "studentName", "tenantId" FROM "BookIssue";
DROP TABLE "BookIssue";
ALTER TABLE "new_BookIssue" RENAME TO "BookIssue";
CREATE INDEX "BookIssue_tenantId_bookId_idx" ON "BookIssue"("tenantId", "bookId");
CREATE INDEX "BookIssue_tenantId_studentId_idx" ON "BookIssue"("tenantId", "studentId");
CREATE INDEX "BookIssue_tenantId_returnedAt_idx" ON "BookIssue"("tenantId", "returnedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

