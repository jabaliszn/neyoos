const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newFields = `  strandId    String?
  strand      CbcStrand? @relation(fields: [strandId], references: [id], onDelete: SetNull)
  competencyId String?
  competency  Competency? @relation(fields: [competencyId], references: [id], onDelete: SetNull)
  assessmentPlanId String?
  assessmentPlan AssessmentPlan? @relation(fields: [assessmentPlanId], references: [id], onDelete: SetNull)
  
  resources   LessonResource[]`;

schema = schema.replace('  topic       String\n  objectives  String?', `  topic       String\n  objectives  String?\n${newFields}`);

const resourceModel = `
model LessonResource {
  id           String      @id @default(cuid())
  tenantId     String
  tenant       Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  lessonPlanId String
  lessonPlan   LessonPlan  @relation(fields: [lessonPlanId], references: [id], onDelete: Cascade)
  fileUrl      String
  fileName     String?
  createdAt    DateTime    @default(now())

  @@index([tenantId, lessonPlanId])
}
`;

if (!schema.includes('model LessonResource')) {
  schema += resourceModel;
}

if (!schema.includes('lessonResources           LessonResource[]')) {
  schema = schema.replace('lessonPlans                LessonPlan[]', 'lessonPlans                LessonPlan[]\n  lessonResources            LessonResource[]');
}

if (!schema.includes('lessonPlans LessonPlan[]') && schema.includes('model CbcStrand {')) {
  schema = schema.replace('assessments     CbcAssessment[]', 'assessments     CbcAssessment[]\n  lessonPlans     LessonPlan[]');
}

if (!schema.includes('lessonPlans LessonPlan[]') && schema.includes('model Competency {')) {
  schema = schema.replace('evidence       CompetencyEvidence[]', 'evidence       CompetencyEvidence[]\n  lessonPlans    LessonPlan[]');
}

if (!schema.includes('lessonPlans LessonPlan[]') && schema.includes('model AssessmentPlan {')) {
  schema = schema.replace('records AssessmentRecord[]', 'records AssessmentRecord[]\n  lessonPlans LessonPlan[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
