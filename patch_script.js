const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const activityCategoryModel = `
// PART J.9 — Activity-Aware Timetable
// Configurable non-academic activity categories (Clubs, STEM, Music, Sports).
model ActivityCategory {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String   // e.g., "STEM Lab", "Drama Club", "Community Service"
  color       String   @default("gray") // Tailwind color stem (blue, green, purple, amber, rose)
  description String?
  maxPerWeek  Int?     // Optional constraint (e.g., max 2 STEM labs per class per week)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  timetableSlots TimetableSlot[]

  @@unique([tenantId, name])
}
`;

// Insert the new model right before Department
schema = schema.replace('model Department {', activityCategoryModel + '\nmodel Department {');

// Update TimetableSlot
const oldSlot = `model TimetableSlot {
  id           String  @id @default(cuid())
  tenantId     String
  tenant       Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  classId      String
  subjectId    String
  subject      Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  teacherId    String? // User
  dayOfWeek    Int // 1=Mon .. 5=Fri
  period       Int // 1..8
  slotType     String  @default("ACADEMIC") // ACADEMIC | REMEDIAL | PREP
  weekRotation String  @default("ALL") // ALL | WEEK_A | WEEK_B for alternating Saturdays
  venue        String? // classroom/lab/hall for venue printing`;

const newSlot = `model TimetableSlot {
  id           String  @id @default(cuid())
  tenantId     String
  tenant       Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  classId      String
  subjectId    String?
  subject      Subject? @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  activityCategoryId String?
  activityCategory   ActivityCategory? @relation(fields: [activityCategoryId], references: [id], onDelete: SetNull)
  teacherId    String? // User
  dayOfWeek    Int // 1=Mon .. 5=Fri
  period       Int // 1..8
  slotType     String  @default("ACADEMIC") // ACADEMIC | REMEDIAL | PREP | ACTIVITY
  weekRotation String  @default("ALL") // ALL | WEEK_A | WEEK_B for alternating Saturdays
  venue        String? // classroom/lab/hall for venue printing`;

schema = schema.replace(oldSlot, newSlot);
fs.writeFileSync('prisma/schema.prisma', schema);
