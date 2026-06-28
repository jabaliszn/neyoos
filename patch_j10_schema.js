const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// 1. Add models at the end
const newModels = `
// PART J.10 — Senior School Pathway Management
// =============================================================================

model Pathway {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String   // e.g. "STEM", "Creative Arts & Sports", "Social Sciences"
  code        String   // e.g. "STEM", "ARTS"
  description String?
  capacity    Int?     // Max students allowed in this pathway per cohort
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  subjectRequirements PathwaySubjectRequirement[]
  studentPreferences  StudentPathwayPreference[]

  @@unique([tenantId, code])
}

model PathwaySubjectRequirement {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  pathwayId   String
  pathway     Pathway  @relation(fields: [pathwayId], references: [id], onDelete: Cascade)
  subjectId   String
  subject     Subject  @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  isCore      Boolean  @default(true) // Core vs Elective in this pathway
  minScorePct Int?     // e.g. Requires 70% in Math to join STEM

  @@unique([tenantId, pathwayId, subjectId])
}

model StudentPathwayPreference {
  id              String   @id @default(cuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId       String
  student         Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  pathwayId       String
  pathway         Pathway  @relation(fields: [pathwayId], references: [id], onDelete: Cascade)
  choiceOrder     Int      @default(1) // 1st choice, 2nd choice
  teacherNotes    String?  // Recommendation/Notes from teacher/counselor
  isRecommended   Boolean  @default(false)
  isAllocated     Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, studentId, pathwayId])
}
`;

if (!schema.includes('model Pathway {')) {
  schema += newModels;
}

// 2. Add back-relations
if (!schema.includes('pathways                   Pathway[]')) {
  schema = schema.replace('activityCategories         ActivityCategory[]', 'activityCategories         ActivityCategory[]\n  pathways                   Pathway[]\n  pathwaySubjectRequirements PathwaySubjectRequirement[]\n  studentPathwayPreferences  StudentPathwayPreference[]');
}

if (!schema.includes('pathwayRequirements PathwaySubjectRequirement[]')) {
  schema = schema.replace('timetableSlots             TimetableSlot[]', 'timetableSlots             TimetableSlot[]\n  pathwayRequirements        PathwaySubjectRequirement[]');
}

if (!schema.includes('pathwayPreferences        StudentPathwayPreference[]')) {
  schema = schema.replace('skillsPassportEntries     SkillsPassportEntry[]', 'skillsPassportEntries     SkillsPassportEntry[]\n  pathwayPreferences        StudentPathwayPreference[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
