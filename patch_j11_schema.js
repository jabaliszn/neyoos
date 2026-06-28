const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

schema = schema.replace('term          Term?      @relation(fields: [termId], references: [id], onDelete: SetNull)', 'term          AcademicTerm?      @relation(fields: [termId], references: [id], onDelete: SetNull)');

if (!schema.includes('talentRecords     TalentRecord[]') && schema.includes('model AcademicTerm {')) {
  schema = schema.replace('model AcademicTerm {', 'model AcademicTerm {\n  talentRecords     TalentRecord[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
