const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModels = `
// PART K.12 — Advanced Student Duty Roster Engine
// =============================================================================

model StudentDutyArea {
  id               String   @id @default(cuid())
  tenantId         String
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name             String   // e.g. "Dining Hall Cleanup", "Library Prefect"
  description      String?
  genderConstraint String   @default("MIXED") // MIXED | BOYS_ONLY | GIRLS_ONLY
  targetClassIds   String   @default("[]") // JSON array of class IDs allowed to do this
  maxStudents      Int      @default(5)
  isActive         Boolean  @default(true)
  
  assignments      StudentDutyAssignment[]

  @@unique([tenantId, name])
}

model StudentDutyAssignment {
  id               String   @id @default(cuid())
  tenantId         String
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId        String
  student          Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  dutyAreaId       String
  dutyArea         StudentDutyArea @relation(fields: [dutyAreaId], references: [id], onDelete: Cascade)
  termId           String?
  term             AcademicTerm? @relation(fields: [termId], references: [id], onDelete: SetNull)
  
  assignedById     String
  assignedByName   String
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([tenantId, studentId, termId]) // Strict K.12 rule: 1 duty per student per term/time
}
`;

if (!schema.includes('model StudentDutyArea {')) {
  schema += newModels;
}

if (!schema.includes('dutyAreas StudentDutyArea[]')) {
  schema = schema.replace('approvalRequests          StudentApprovalRequest[]', 'approvalRequests          StudentApprovalRequest[]\n  dutyAreas                 StudentDutyArea[]\n  dutyAssignments           StudentDutyAssignment[]');
}

if (!schema.includes('dutyAssignments StudentDutyAssignment[]')) {
  schema = schema.replace('approvalRequests StudentApprovalRequest[]', 'approvalRequests StudentApprovalRequest[]\n  dutyAssignments  StudentDutyAssignment[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
