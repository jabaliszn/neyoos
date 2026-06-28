const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModel = `
// PART L.5 — Term Promotions & Repeats
// =============================================================================

model PromotionRequest {
  id               String   @id @default(cuid())
  tenantId         String
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId        String
  student          Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  requestedById    String
  requestedByName  String
  
  action           String   @default("REPEAT") // REPEAT | ACCELERATE
  reason           String
  
  status           String   @default("PENDING") // PENDING | APPROVED | REJECTED
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([tenantId, studentId])
}
`;

if (!schema.includes('model PromotionRequest {')) {
  schema += newModel;
}

if (!schema.includes('promotionRequests         PromotionRequest[]')) {
  schema = schema.replace('subjectSelections StudentSubjectSelection[]', 'subjectSelections StudentSubjectSelection[]\n  promotionRequests         PromotionRequest[]');
}

if (!schema.includes('promotionRequests         PromotionRequest[]') && schema.includes('model Tenant {')) {
  schema = schema.replace('studentSubjectSelections  StudentSubjectSelection[]', 'studentSubjectSelections  StudentSubjectSelection[]\n  promotionRequests         PromotionRequest[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
