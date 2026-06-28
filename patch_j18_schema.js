const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModel = `
// PART J.18 — Career Discovery & Pathway Guidance
// =============================================================================

model CareerDiscoveryRecord {
  id              String   @id @default(cuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId       String
  student         Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  recordType      String   // "STUDENT_INTEREST" | "TEACHER_RECOMMENDATION" | "PARENT_CONVERSATION"
  careerArea      String?  // e.g. "Engineering", "Medicine", "ICT"
  notes           String   // Narrative/Reasoning
  
  recordedById    String
  recordedByName  String
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, studentId])
}
`;

if (!schema.includes('model CareerDiscoveryRecord {')) {
  schema += newModel;
}

if (!schema.includes('careerDiscoveryRecords    CareerDiscoveryRecord[]')) {
  schema = schema.replace('communityServiceActivities CommunityServiceActivity[]', 'communityServiceActivities CommunityServiceActivity[]\n  careerDiscoveryRecords    CareerDiscoveryRecord[]');
}

if (!schema.includes('careerDiscoveryRecords        CareerDiscoveryRecord[]')) {
  schema = schema.replace('communityServiceActivities    CommunityServiceActivity[]', 'communityServiceActivities    CommunityServiceActivity[]\n  careerDiscoveryRecords        CareerDiscoveryRecord[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
