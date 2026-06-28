const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModel = `
// PART J.15 — Modular Report Builder
// =============================================================================

model ReportTemplate {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String   // e.g. "CBC Comprehensive Report", "Standard 8-4-4 End of Term"
  description String?
  isDefault   Boolean  @default(false)
  
  // JSON array of section objects, e.g. [{ type: "HEADER" }, { type: "MARKS_TABLE", showPosition: false }, { type: "TALENT" }]
  sectionsJson String  @default("[]") 
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, name])
}
`;

if (!schema.includes('model ReportTemplate {')) {
  schema += newModel;
}

if (!schema.includes('reportTemplates            ReportTemplate[]')) {
  schema = schema.replace('LessonResource            LessonResource[]', 'LessonResource            LessonResource[]\n  reportTemplates           ReportTemplate[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
