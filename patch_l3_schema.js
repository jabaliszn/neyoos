const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const tsMatch = `model TeacherSubject {
  id        String @id @default(cuid())
  tenantId  String
  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  teacherId String // User.id
  subjectId String // Subject.id`;

const tsReplace = `model TeacherSubject {
  id        String @id @default(cuid())
  tenantId  String
  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  teacherId String // User.id
  subjectId String // Subject.id
  isStrong  Boolean @default(false) // L.3 Strong area preference`;

if (!schema.includes('isStrong  Boolean @default(false) // L.3')) {
  schema = schema.replace(tsMatch, tsReplace);
  fs.writeFileSync('prisma/schema.prisma', schema);
}
