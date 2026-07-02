-- AlterTable
ALTER TABLE "StudentImport" ADD COLUMN "targetClassId" TEXT;

-- CreateTable
CREATE TABLE "StudentCustomField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentCustomField_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentCustomField_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudentCustomField_tenantId_studentId_idx" ON "StudentCustomField"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCustomField_studentId_label_key" ON "StudentCustomField"("studentId", "label");
