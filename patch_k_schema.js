const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModels = `
// PART K — Advanced Grading & Computation Engine
// =============================================================================

// Controls the window for teachers to enter marks.
model MarksPortal {
  id               String    @id @default(cuid())
  tenantId         String
  tenant           Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  termId           String?   // Links to AcademicTerm
  term             AcademicTerm? @relation(fields: [termId], references: [id], onDelete: Cascade)
  
  name             String    // "Term 2 2026 Marks Entry"
  openDate         DateTime  // When teachers can start entering
  closeDate        DateTime  // When the portal locks
  
  // OPEN | CLOSED | COMPUTING | PENDING_RELEASE | RELEASED
  status           String    @default("OPEN") 
  
  // Computation tracking
  computationStartedAt DateTime?
  computationEndedAt   DateTime?
  computationProgress  Int       @default(0) // 0 to 100 percentage
  computationTotalRows Int       @default(0)
  
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([tenantId])
}

// Hierarchical configuration for term weighting (Global -> Class -> Subject)
model TermAggregationRule {
  id               String    @id @default(cuid())
  tenantId         String
  tenant           Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  // If classId and subjectId are null, it's the GLOBAL school rule.
  classId          String?   
  subjectId        String?
  
  isTraditional    Boolean   @default(false) // If true, ignore weights and use standard average
  
  // JSON array mapping Assessment types to Weights
  // e.g., [{ "sourceType": "EXAM", "sourceId": "cat1_id", "weightPct": 25 }]
  weightingsJson   String    @default("[]")
  
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@unique([tenantId, classId, subjectId])
}

// Configures PP1, PP2, Practicals for a specific subject
model SubjectPaperConfig {
  id               String    @id @default(cuid())
  tenantId         String
  tenant           Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  subjectId        String
  subject          Subject   @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  classId          String?   // If papers differ per class level
  
  name             String    // e.g. "Paper 1", "Practical"
  outOfMarks       Int       @default(100) // The raw marks limit (e.g., out of 40)
  weightPct        Int       // How much this paper contributes to the final Subject mark (e.g., 40%)
  
  paperResults     PaperResult[]
  
  @@unique([tenantId, subjectId, classId, name])
}

// The raw marks scored in a specific paper
model PaperResult {
  id               String    @id @default(cuid())
  tenantId         String
  tenant           Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  examResultId     String    
  examResult       ExamResult @relation(fields: [examResultId], references: [id], onDelete: Cascade)
  paperConfigId    String
  paperConfig      SubjectPaperConfig @relation(fields: [paperConfigId], references: [id], onDelete: Cascade)
  
  marksScored      Float?    // The raw entry (e.g., 35 out of 40)
  
  @@unique([tenantId, examResultId, paperConfigId])
}
`;

if (!schema.includes('model MarksPortal {')) {
  schema += newModels;
}

// Add opposite relations
if (!schema.includes('marksPortals              MarksPortal[]')) {
  schema = schema.replace('passportRequests          TransferPassportRequest[]', 'passportRequests          TransferPassportRequest[]\n  marksPortals              MarksPortal[]\n  termAggregationRules      TermAggregationRule[]\n  subjectPaperConfigs       SubjectPaperConfig[]\n  paperResults              PaperResult[]');
}
if (!schema.includes('marksPortals MarksPortal[]')) {
  schema = schema.replace('talentRecords     TalentRecord[]', 'talentRecords     TalentRecord[]\n  marksPortals      MarksPortal[]');
}
if (!schema.includes('paperConfigs SubjectPaperConfig[]')) {
  schema = schema.replace('lessonPlans       LessonPlan[]', 'lessonPlans       LessonPlan[]\n  paperConfigs      SubjectPaperConfig[]');
}
if (!schema.includes('paperResults PaperResult[]')) {
  schema = schema.replace('student         Student @relation(fields: [studentId], references: [id], onDelete: Cascade)', 'student         Student @relation(fields: [studentId], references: [id], onDelete: Cascade)\n  paperResults    PaperResult[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
