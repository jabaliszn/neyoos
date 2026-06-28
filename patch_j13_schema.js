const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModel = `
// PART J.13 — Parent Growth Dashboard (Student Goals)
// =============================================================================

model StudentGoal {
  id                   String   @id @default(cuid())
  tenantId             String
  tenant               Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId            String
  student              Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  termId               String?
  term                 AcademicTerm? @relation(fields: [termId], references: [id], onDelete: SetNull)
  teacherId            String
  teacher              User     @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  
  category             String   // e.g. "ACADEMIC", "SOCIAL", "TALENT", "BEHAVIOR"
  title                String
  description          String?
  targetDate           String?  // YYYY-MM-DD
  
  acknowledgedByParent Boolean  @default(false)
  acknowledgedAt       DateTime?
  status               String   @default("ACTIVE") // ACTIVE | ACHIEVED | MISSED
  
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([tenantId, studentId])
}
`;

if (!schema.includes('model StudentGoal {')) {
  schema += newModel;
}

if (!schema.includes('studentGoals               StudentGoal[]')) {
  schema = schema.replace('talentRecords              TalentRecord[]', 'talentRecords              TalentRecord[]\n  studentGoals               StudentGoal[]');
}

if (!schema.includes('goals                     StudentGoal[]')) {
  schema = schema.replace('talentRecords             TalentRecord[]', 'talentRecords             TalentRecord[]\n  goals                     StudentGoal[]');
}

if (!schema.includes('teacherGoals               StudentGoal[]')) {
  schema = schema.replace('coachedTalentRecords       TalentRecord[]', 'coachedTalentRecords       TalentRecord[]\n  teacherGoals               StudentGoal[]');
}

if (!schema.includes('studentGoals      StudentGoal[]')) {
  schema = schema.replace('talentRecords     TalentRecord[]', 'talentRecords     TalentRecord[]\n  studentGoals      StudentGoal[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
