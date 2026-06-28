const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModel = `
// PART J.21 — NEYO Ops Curriculum Template Library
// =============================================================================

model GlobalCurriculumTemplate {
  id                String   @id @default(cuid())
  name              String   // e.g. "CBC Kenya Junior School"
  country           String   @default("Kenya")
  context           String?  // e.g. "Grade 7-9"
  version           String   @default("v1")
  description       String?
  status            String   @default("DRAFT") // DRAFT | PUBLISHED
  
  // JSON array of learning areas: [{ name, code, description }]
  learningAreasJson String   @default("[]") 
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
`;

if (!schema.includes('model GlobalCurriculumTemplate {')) {
  schema += newModel;
  fs.writeFileSync('prisma/schema.prisma', schema);
}
