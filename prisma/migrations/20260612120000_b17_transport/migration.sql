-- CreateTable
CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stops" TEXT,
    "termFeeKes" INTEGER NOT NULL DEFAULT 0,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransportRoute_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransportRoute_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNo" TEXT NOT NULL,
    "licenseExpiry" TEXT,
    "nationalId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Driver_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "regNo" TEXT NOT NULL,
    "make" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 33,
    "insuranceExpiry" TEXT,
    "inspectionExpiry" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VehicleMaintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "costKes" INTEGER NOT NULL DEFAULT 0,
    "odometerKm" INTEGER,
    "garage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleMaintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FuelLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "litres" REAL NOT NULL,
    "costKes" INTEGER NOT NULL,
    "odometerKm" INTEGER,
    "station" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FuelLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "pickupStop" TEXT,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" DATETIME,
    CONSTRAINT "TransportAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TransportRoute_tenantId_idx" ON "TransportRoute"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoute_tenantId_name_key" ON "TransportRoute"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Driver_tenantId_idx" ON "Driver"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_tenantId_licenseNo_key" ON "Driver"("tenantId", "licenseNo");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_idx" ON "Vehicle"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_tenantId_regNo_key" ON "Vehicle"("tenantId", "regNo");

-- CreateIndex
CREATE INDEX "VehicleMaintenance_tenantId_vehicleId_date_idx" ON "VehicleMaintenance"("tenantId", "vehicleId", "date");

-- CreateIndex
CREATE INDEX "FuelLog_tenantId_vehicleId_date_idx" ON "FuelLog"("tenantId", "vehicleId", "date");

-- CreateIndex
CREATE INDEX "TransportAssignment_tenantId_routeId_idx" ON "TransportAssignment"("tenantId", "routeId");

-- CreateIndex
CREATE INDEX "TransportAssignment_tenantId_studentId_idx" ON "TransportAssignment"("tenantId", "studentId");

