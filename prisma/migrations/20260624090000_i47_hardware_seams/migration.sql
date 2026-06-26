-- I.47 — hardware connection seams and truthful status registry.
CREATE TABLE "HardwareDeviceConnection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "deviceType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
  "deviceName" TEXT,
  "lastSeenAt" DATETIME,
  "metadataJson" TEXT,
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "HardwareDeviceConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HardwareDeviceConnection_tenantId_deviceType_label_key" ON "HardwareDeviceConnection"("tenantId", "deviceType", "label");
CREATE INDEX "HardwareDeviceConnection_tenantId_deviceType_status_idx" ON "HardwareDeviceConnection"("tenantId", "deviceType", "status");

CREATE TABLE "GpsBusLocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "vehicleId" TEXT,
  "vehicleRegNo" TEXT,
  "trackerId" TEXT NOT NULL,
  "lat" REAL NOT NULL,
  "lng" REAL NOT NULL,
  "speedKph" REAL,
  "headingDeg" REAL,
  "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GpsBusLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "GpsBusLocation_tenantId_trackerId_recordedAt_idx" ON "GpsBusLocation"("tenantId", "trackerId", "recordedAt");
CREATE INDEX "GpsBusLocation_tenantId_vehicleId_recordedAt_idx" ON "GpsBusLocation"("tenantId", "vehicleId", "recordedAt");

CREATE TABLE "CctvCamera" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "streamUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
  "lastCheckedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CctvCamera_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CctvCamera_tenantId_name_key" ON "CctvCamera"("tenantId", "name");
CREATE INDEX "CctvCamera_tenantId_status_idx" ON "CctvCamera"("tenantId", "status");
