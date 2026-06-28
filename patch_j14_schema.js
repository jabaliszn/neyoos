const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModel = `
// PART J.14 — Student Digital Identity & Transfer Passport
// =============================================================================

model TransferPassportRequest {
  id                  String    @id @default(cuid())
  sourceTenantId      String
  sourceTenant        Tenant    @relation("SourceTenant", fields: [sourceTenantId], references: [id], onDelete: Cascade)
  destinationTenantId String?
  destinationTenant   Tenant?   @relation("DestinationTenant", fields: [destinationTenantId], references: [id], onDelete: SetNull)
  destinationEmail    String?   // For transfers to non-NEYO schools
  
  studentId           String
  student             Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  studentName         String
  
  accessCode          String    @unique // Secure pin/code required to unlock the passport
  expiresAt           DateTime
  status              String    @default("PENDING") // PENDING | COMPLETED | CANCELLED | EXPIRED
  
  includedModules     String    // JSON array: ["ACADEMIC", "ATTENDANCE", "DISCIPLINE", "PORTFOLIO", "MEDICAL"]
  consentBy           String    // Name of parent/guardian who gave legal consent
  consentDate         DateTime  @default(now())
  
  payloadJson         String?   // The actual aggregated digital identity snapshot
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@index([sourceTenantId])
  @@index([destinationTenantId])
  @@index([studentId])
}
`;

if (!schema.includes('model TransferPassportRequest {')) {
  schema += newModel;
}

if (!schema.includes('outgoingPassports')) {
  schema = schema.replace('studentGoals               StudentGoal[]', 'studentGoals               StudentGoal[]\n  outgoingPassports          TransferPassportRequest[] @relation("SourceTenant")\n  incomingPassports          TransferPassportRequest[] @relation("DestinationTenant")');
}

if (!schema.includes('passportRequests')) {
  schema = schema.replace('goals                     StudentGoal[]', 'goals                     StudentGoal[]\n  passportRequests          TransferPassportRequest[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
