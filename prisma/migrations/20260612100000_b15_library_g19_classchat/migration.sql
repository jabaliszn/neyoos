-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "classId" TEXT;

-- CreateTable
CREATE TABLE "LibraryBook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "category" TEXT,
    "shelf" TEXT,
    "copiesTotal" INTEGER NOT NULL DEFAULT 1,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryBook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
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

-- CreateIndex
CREATE INDEX "LibraryBook_tenantId_archived_idx" ON "LibraryBook"("tenantId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryBook_tenantId_isbn_key" ON "LibraryBook"("tenantId", "isbn");

-- CreateIndex
CREATE INDEX "BookIssue_tenantId_bookId_idx" ON "BookIssue"("tenantId", "bookId");

-- CreateIndex
CREATE INDEX "BookIssue_tenantId_studentId_idx" ON "BookIssue"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "BookIssue_tenantId_returnedAt_idx" ON "BookIssue"("tenantId", "returnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_tenantId_classId_key" ON "Conversation"("tenantId", "classId");

