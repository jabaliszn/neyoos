const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const tsMatch = `model Student {
  id       String @id @default(cuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  admissionNo       String // school-side ID, e.g. KH-S-000247 (A.4)
  legacyAdmissionNo String? // school's own pre-existing legacy admission number (A.1.8)
  firstName         String
  middleName        String?
  lastName          String
  gender            String // "M" | "F"
  dateOfBirth       String? // YYYY-MM-DD
  photoUrl          String?
  status            String // ACTIVE | INACTIVE | GRADUATED | TRANSFERRED | SUSPENDED`;

const tsReplace = `model Student {
  id       String @id @default(cuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  admissionNo       String // school-side ID, e.g. KH-S-000247 (A.4)
  legacyAdmissionNo String? // school's own pre-existing legacy admission number (A.1.8)
  firstName         String
  middleName        String?
  lastName          String
  gender            String // "M" | "F"
  dateOfBirth       String? // YYYY-MM-DD
  photoUrl          String?
  status            String // ACTIVE | INACTIVE | GRADUATED | TRANSFERRED | SUSPENDED | UNKNOWN`;

if (!schema.includes('status            String // ACTIVE | INACTIVE | GRADUATED | TRANSFERRED | SUSPENDED | UNKNOWN')) {
  schema = schema.replace(tsMatch, tsReplace);
  fs.writeFileSync('prisma/schema.prisma', schema);
}
