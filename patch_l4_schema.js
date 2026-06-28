const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModels = `
// PART L.4 — Student Subject Selection (Electives)
// =============================================================================

model SubjectSelectionPortal {
  id               String   @id @default(cuid())
  tenantId         String
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  name             String   // e.g. "Form 3 Subject Selection 2026"
  targetLevel      String   // e.g. "Form 3"
  
  openDate         DateTime
  closeDate        DateTime
  status           String   @default("OPEN") // OPEN | CLOSED | FINALIZED
  
  // JSON defining the rules: { "minElectives": 2, "maxElectives": 3, "compulsory": ["ENG", "MAT"] }
  rulesJson        String   @default("{}")
  
  selections       StudentSubjectSelection[]

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([tenantId])
}

model StudentSubjectSelection {
  id               String   @id @default(cuid())
  tenantId         String
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  portalId         String
  portal           SubjectSelectionPortal @relation(fields: [portalId], references: [id], onDelete: Cascade)
  studentId        String
  student          Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  // JSON array of subject IDs the student selected
  selectedSubjectIds String @default("[]")
  
  isConfirmed      Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([tenantId, portalId, studentId])
}
`;

if (!schema.includes('model SubjectSelectionPortal {')) {
  schema += newModels;
}

if (!schema.includes('subjectSelectionPortals   SubjectSelectionPortal[]')) {
  schema = schema.replace('dutyAssignments           StudentDutyAssignment[]', 'dutyAssignments           StudentDutyAssignment[]\n  subjectSelectionPortals   SubjectSelectionPortal[]\n  studentSubjectSelections  StudentSubjectSelection[]');
}

if (!schema.includes('subjectSelections StudentSubjectSelection[]')) {
  schema = schema.replace('dutyAssignments  StudentDutyAssignment[]', 'dutyAssignments  StudentDutyAssignment[]\n  subjectSelections StudentSubjectSelection[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
