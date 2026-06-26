-- CreateTable
CREATE TABLE "MealPlanEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "mealType" TEXT NOT NULL,
    "menu" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MealPlanEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "cardNo" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "meals" TEXT NOT NULL,
    "termFeeKes" INTEGER NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    CONSTRAINT "MealCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MealPlanEntry_tenantId_idx" ON "MealPlanEntry"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanEntry_tenantId_dayOfWeek_mealType_key" ON "MealPlanEntry"("tenantId", "dayOfWeek", "mealType");

-- CreateIndex
CREATE INDEX "MealCard_tenantId_studentId_idx" ON "MealCard"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MealCard_tenantId_cardNo_key" ON "MealCard"("tenantId", "cardNo");

