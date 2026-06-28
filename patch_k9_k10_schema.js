const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModels = `
// PART K.10 — Parent Uploads & Approval Workflows
// =============================================================================

model StudentApprovalRequest {
  id               String   @id @default(cuid())
  tenantId         String
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId        String
  student          Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  requestedByRole  String   // "PARENT" | "TEACHER"
  requestedById    String   // User ID
  requestedByName  String
  
  requestType      String   // "PHOTO_UPDATE" | "DOCUMENT_UPLOAD"
  
  // Details
  documentLabel    String?
  fileUrl          String
  fileName         String?
  
  status           String   @default("PENDING") // PENDING | APPROVED | REJECTED
  
  reviewedById     String?
  reviewedByName   String?
  reviewedAt       DateTime?
  rejectionReason  String?
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([tenantId, studentId])
}
`;

if (!schema.includes('model StudentApprovalRequest {')) {
  schema += newModels;
}

if (!schema.includes('approvalRequests StudentApprovalRequest[]')) {
  schema = schema.replace('paperResults    PaperResult[]', 'paperResults    PaperResult[]\n  approvalRequests StudentApprovalRequest[]');
}

if (!schema.includes('approvalRequests          StudentApprovalRequest[]')) {
  schema = schema.replace('paperResults              PaperResult[]', 'paperResults              PaperResult[]\n  approvalRequests          StudentApprovalRequest[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
