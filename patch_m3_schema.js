const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const oldEvent = `model CalendarEvent {
  id          String    @id @default(cuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  title       String
  description String?
  startDate   String // YYYY-MM-DD
  endDate     String? // YYYY-MM-DD (null = single day)`;

const newEvent = `model CalendarEvent {
  id          String    @id @default(cuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  title       String
  description String?
  startDate   String // YYYY-MM-DD
  endDate     String? // YYYY-MM-DD (null = single day)
  
  targetAudience String @default("ALL") // ALL | STAFF | STUDENTS | PARENTS`;

if (!schema.includes('targetAudience String @default("ALL")')) {
  schema = schema.replace(oldEvent, newEvent);
  fs.writeFileSync('prisma/schema.prisma', schema);
}
