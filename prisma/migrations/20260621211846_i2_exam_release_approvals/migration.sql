-- DropIndex
DROP INDEX "Invoice_tenantId_kind_year_term_idx";

-- CreateTable
CREATE TABLE "ExamReleaseApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "summaryJson" TEXT,
    CONSTRAINT "ExamReleaseApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamReleaseApprovalRequest_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExamReleaseApprovalRequest_tenantId_status_requestedAt_idx" ON "ExamReleaseApprovalRequest"("tenantId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "ExamReleaseApprovalRequest_tenantId_examId_idx" ON "ExamReleaseApprovalRequest"("tenantId", "examId");
