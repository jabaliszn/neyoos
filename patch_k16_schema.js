const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModel = `
// PART K.16 — KNEC Document Aggregation
// =============================================================================

model KnecExportBatch {
  id               String   @id @default(cuid())
  tenantId         String
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  name             String   // e.g. "2026 KCSE Candidates Batch"
  status           String   @default("DRAFT") // DRAFT | EXPORTED
  
  targetClassId    String?  // The specific class/stream this targets
  documentLabels   String   // JSON Array of required labels e.g. ["Birth Certificate", "KNEC Registration Form"]
  
  // A snapshot payload containing the generated zip/pdf URL if exported
  exportUrl        String?
  
  createdById      String
  createdByName    String
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([tenantId])
}
`;

if (!schema.includes('model KnecExportBatch {')) {
  schema += newModel;
}

if (!schema.includes('knecExportBatches         KnecExportBatch[]')) {
  schema = schema.replace('dutyAssignments           StudentDutyAssignment[]', 'dutyAssignments           StudentDutyAssignment[]\n  knecExportBatches         KnecExportBatch[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
