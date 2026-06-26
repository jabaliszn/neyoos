-- CreateTable
CREATE TABLE "UniformSize" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UniformSize_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UniformSize_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UniformSize_tenantId_itemId_size_key" ON "UniformSize"("tenantId", "itemId", "size");
