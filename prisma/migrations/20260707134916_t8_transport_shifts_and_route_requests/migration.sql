-- CreateTable
CREATE TABLE "TransportShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "seatCapOverride" INTEGER,
    "termFeeKesOverride" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportShift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransportShift_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransportShift_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransportShift_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportRouteChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "currentRouteId" TEXT,
    "currentShiftId" TEXT,
    "requestedRouteId" TEXT NOT NULL,
    "requestedShiftId" TEXT,
    "requestedPickupStop" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" DATETIME,
    "declineReason" TEXT,
    "billingActionTaken" TEXT,
    "billingNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransportRouteChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransportRouteChangeRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "county" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "osKey" TEXT NOT NULL DEFAULT 'school',
    "principalSignatureUrl" TEXT,
    "schoolStampUrl" TEXT,
    "curriculum" TEXT,
    "educationLevelsOffered" TEXT,
    "onboardedAt" DATETIME,
    "referralCode" TEXT,
    "referredByTenantId" TEXT,
    "hasClaimedReferral" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "demoExpiresAt" DATETIME,
    "schoolType" TEXT NOT NULL DEFAULT 'DAY',
    "uniformSupplierName" TEXT,
    "uniformSupplierPhone" TEXT,
    "pathwaySchoolType" TEXT NOT NULL DEFAULT 'NONE',
    "enabledPathwayGroups" TEXT DEFAULT '[]',
    "showReligiousHolidays" BOOLEAN NOT NULL DEFAULT true,
    "libraryFinesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "libraryFinePerDayKes" INTEGER NOT NULL DEFAULT 10,
    "motto" TEXT,
    "vision" TEXT,
    "mission" TEXT,
    "about" TEXT,
    "logoUrl" TEXT,
    "brandPrimary" TEXT,
    "brandAccent" TEXT,
    "addressLine" TEXT,
    "socialLinks" TEXT,
    "joiningRequirements" TEXT,
    "documentDesignJson" TEXT,
    "gpsLat" REAL,
    "gpsLng" REAL,
    "gpsRadiusM" INTEGER,
    "collectionTargetPct" INTEGER NOT NULL DEFAULT 85,
    "poApprovalThresholdKes" INTEGER NOT NULL DEFAULT 50000,
    "expenseApprovalThresholdKes" INTEGER NOT NULL DEFAULT 20000,
    "siblingDiscountPct" INTEGER NOT NULL DEFAULT 0,
    "transportMidTermBillingRule" TEXT NOT NULL DEFAULT 'NEXT_TERM_ONLY',
    "allowParentTransportRequests" BOOLEAN NOT NULL DEFAULT false,
    "requireBiometricForFinance" BOOLEAN NOT NULL DEFAULT false,
    "enforce2Fa" BOOLEAN NOT NULL DEFAULT false,
    "requireJointOwnerApproval" BOOLEAN NOT NULL DEFAULT false,
    "printLimitPerDay" INTEGER DEFAULT 0,
    "printStationMode" TEXT NOT NULL DEFAULT 'AUTO',
    "cafeteriaTableSize" INTEGER NOT NULL DEFAULT 8,
    "cafeteriaMealModel" TEXT NOT NULL DEFAULT 'HYBRID',
    "cafeteriaMealScope" TEXT NOT NULL DEFAULT 'ALL',
    "navVisibility" TEXT,
    "encryptedDek" TEXT,
    "dekIv" TEXT,
    "dekTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tenant_referredByTenantId_fkey" FOREIGN KEY ("referredByTenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Tenant" ("about", "addressLine", "brandAccent", "brandPrimary", "cafeteriaMealModel", "cafeteriaMealScope", "cafeteriaTableSize", "collectionTargetPct", "county", "createdAt", "curriculum", "dekIv", "dekTag", "demoExpiresAt", "documentDesignJson", "educationLevelsOffered", "email", "enabledPathwayGroups", "encryptedDek", "enforce2Fa", "expenseApprovalThresholdKes", "gpsLat", "gpsLng", "gpsRadiusM", "hasClaimedReferral", "id", "isDemo", "joiningRequirements", "libraryFinePerDayKes", "libraryFinesEnabled", "logoUrl", "mission", "motto", "name", "navVisibility", "onboardedAt", "osKey", "pathwaySchoolType", "phone", "poApprovalThresholdKes", "principalSignatureUrl", "printLimitPerDay", "printStationMode", "referralCode", "referredByTenantId", "requireBiometricForFinance", "requireJointOwnerApproval", "schoolStampUrl", "schoolType", "showReligiousHolidays", "siblingDiscountPct", "slug", "socialLinks", "uniformSupplierName", "uniformSupplierPhone", "updatedAt", "vision") SELECT "about", "addressLine", "brandAccent", "brandPrimary", "cafeteriaMealModel", "cafeteriaMealScope", "cafeteriaTableSize", "collectionTargetPct", "county", "createdAt", "curriculum", "dekIv", "dekTag", "demoExpiresAt", "documentDesignJson", "educationLevelsOffered", "email", "enabledPathwayGroups", "encryptedDek", "enforce2Fa", "expenseApprovalThresholdKes", "gpsLat", "gpsLng", "gpsRadiusM", "hasClaimedReferral", "id", "isDemo", "joiningRequirements", "libraryFinePerDayKes", "libraryFinesEnabled", "logoUrl", "mission", "motto", "name", "navVisibility", "onboardedAt", "osKey", "pathwaySchoolType", "phone", "poApprovalThresholdKes", "principalSignatureUrl", "printLimitPerDay", "printStationMode", "referralCode", "referredByTenantId", "requireBiometricForFinance", "requireJointOwnerApproval", "schoolStampUrl", "schoolType", "showReligiousHolidays", "siblingDiscountPct", "slug", "socialLinks", "uniformSupplierName", "uniformSupplierPhone", "updatedAt", "vision" FROM "Tenant";
DROP TABLE "Tenant";
ALTER TABLE "new_Tenant" RENAME TO "Tenant";
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "Tenant_referralCode_key" ON "Tenant"("referralCode");
CREATE INDEX "Tenant_osKey_idx" ON "Tenant"("osKey");
CREATE TABLE "new_TransportAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "shiftId" TEXT,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "pickupStop" TEXT,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" DATETIME,
    CONSTRAINT "TransportAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransportAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "TransportShift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TransportAssignment" ("admissionNo", "assignedAt", "id", "pickupStop", "releasedAt", "routeId", "studentId", "studentName", "tenantId") SELECT "admissionNo", "assignedAt", "id", "pickupStop", "releasedAt", "routeId", "studentId", "studentName", "tenantId" FROM "TransportAssignment";
DROP TABLE "TransportAssignment";
ALTER TABLE "new_TransportAssignment" RENAME TO "TransportAssignment";
CREATE INDEX "TransportAssignment_tenantId_routeId_idx" ON "TransportAssignment"("tenantId", "routeId");
CREATE INDEX "TransportAssignment_tenantId_studentId_idx" ON "TransportAssignment"("tenantId", "studentId");
CREATE INDEX "TransportAssignment_tenantId_shiftId_idx" ON "TransportAssignment"("tenantId", "shiftId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TransportShift_tenantId_routeId_idx" ON "TransportShift"("tenantId", "routeId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportShift_tenantId_routeId_name_key" ON "TransportShift"("tenantId", "routeId", "name");

-- CreateIndex
CREATE INDEX "TransportRouteChangeRequest_tenantId_status_idx" ON "TransportRouteChangeRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TransportRouteChangeRequest_tenantId_studentId_idx" ON "TransportRouteChangeRequest"("tenantId", "studentId");
