-- I.7 Gate Pass & Discipline Authority approvals.
ALTER TABLE "GatePass" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "GatePass" ADD COLUMN "approvedByName" TEXT;
ALTER TABLE "GatePass" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "GatePass" ADD COLUMN "decisionNote" TEXT;

ALTER TABLE "Suspension" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Suspension" ADD COLUMN "approvedByName" TEXT;
ALTER TABLE "Suspension" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "Suspension" ADD COLUMN "decisionNote" TEXT;

ALTER TABLE "DisciplineIncident" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "DisciplineIncident" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "DisciplineIncident" ADD COLUMN "approvedByName" TEXT;
ALTER TABLE "DisciplineIncident" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "DisciplineIncident" ADD COLUMN "decisionNote" TEXT;
