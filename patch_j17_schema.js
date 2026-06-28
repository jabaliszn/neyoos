const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModel = `
// PART J.17 — Community Service Module
// =============================================================================

model CommunityServiceActivity {
  id               String   @id @default(cuid())
  tenantId         String
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId        String
  student          Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  title            String   // e.g. "Tree Planting", "Orphanage Visit"
  category         String   // e.g. "ENVIRONMENT", "CHARITY", "SCHOOL_SERVICE"
  date             String   // YYYY-MM-DD
  hours            Int      // Number of hours volunteered
  location         String?
  supervisorName   String?
  supervisorPhone  String?
  
  studentReflection String? // Qualitative note on what they learned
  status           String   @default("APPROVED") // PENDING | APPROVED | REJECTED
  
  proofFileId      String?  // Links to StoredFile if evidence uploaded
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([tenantId, studentId])
}
`;

if (!schema.includes('model CommunityServiceActivity {')) {
  schema += newModel;
}

if (!schema.includes('communityServiceActivities CommunityServiceActivity[]')) {
  schema = schema.replace('passportRequests          TransferPassportRequest[]', 'passportRequests          TransferPassportRequest[]\n  communityServiceActivities CommunityServiceActivity[]');
}

if (!schema.includes('communityServiceActivities    CommunityServiceActivity[]')) {
  schema = schema.replace('reportTemplates           ReportTemplate[]', 'reportTemplates           ReportTemplate[]\n  communityServiceActivities    CommunityServiceActivity[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
