const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const curriculumUpdate = `
  status        String   @default("ACTIVE") // DRAFT | ACTIVE | ARCHIVED
  previousVersionId String?
  previousVersion   Curriculum?  @relation("CurriculumHistory", fields: [previousVersionId], references: [id], onDelete: SetNull)
  nextVersions      Curriculum[] @relation("CurriculumHistory")
`;

if (!schema.includes('previousVersionId String?')) {
  schema = schema.replace(
    'isActive      Boolean  @default(true)',
    `isActive      Boolean  @default(true)\n${curriculumUpdate}`
  );
}

const templateUpdate = `
  effectiveFrom String? // YYYY-MM-DD
  effectiveTo   String? // YYYY-MM-DD
`;

if (!schema.includes('effectiveFrom String?') && schema.includes('model ReportTemplate {')) {
  schema = schema.replace(
    'isDefault   Boolean  @default(false)',
    `isDefault   Boolean  @default(false)\n${templateUpdate}`
  );
}

fs.writeFileSync('prisma/schema.prisma', schema);
