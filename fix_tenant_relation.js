const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const lines = schema.split('\n');
const newLines = [];
let inTenant = false;
let inStudent = false;

for (const line of lines) {
  if (line.startsWith('model Tenant {')) inTenant = true;
  if (line.startsWith('model Student {')) inStudent = true;
  
  if (inTenant && line.startsWith('}')) {
    newLines.push('  outgoingPassports TransferPassportRequest[] @relation("SourceTenant")');
    newLines.push('  incomingPassports TransferPassportRequest[] @relation("DestinationTenant")');
    inTenant = false;
  }
  
  if (inStudent && line.startsWith('}')) {
    newLines.push('  passportRequests TransferPassportRequest[]');
    inStudent = false;
  }
  
  if ((inTenant || inStudent) && line.includes('TransferPassportRequest')) {
    continue; // Remove any auto-added duplicates
  }
  
  newLines.push(line);
}

fs.writeFileSync('prisma/schema.prisma', newLines.join('\n'));
