const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newFields = `
  // PART M.1 — NEYO Referral Engine
  referralCode       String?   @unique
  referredByTenantId String?
  referredBy         Tenant?   @relation("TenantReferrals", fields: [referredByTenantId], references: [id], onDelete: SetNull)
  referrals          Tenant[]  @relation("TenantReferrals")
  hasClaimedReferral Boolean   @default(false)
`;

if (!schema.includes('referralCode       String?')) {
  schema = schema.replace(
    'isDemo                Boolean   @default(false)',
    `${newFields}\n  isDemo                Boolean   @default(false)`
  );
}

const marginModel = `
// PART M.2 — SMS Margin Revenue (NEYO Ops)
// =============================================================================

model SmsMarginLedger {
  id              String   @id @default(cuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  messageCount    Int
  costPerSmsKes   Float    // What NEYO pays Africa's Talking (e.g. 0.8)
  pricePerSmsKes  Float    // What NEYO charges the school (e.g. 1.2)
  marginKes       Float    // Computed profit (e.g. 0.4)
  
  status          String   @default("UNBILLED") // UNBILLED | INVOICED
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, status])
}
`;

if (!schema.includes('model SmsMarginLedger {')) {
  schema += marginModel;
}

if (!schema.includes('smsMarginLedgers           SmsMarginLedger[]')) {
  schema = schema.replace('subjectSelections StudentSubjectSelection[]', 'subjectSelections StudentSubjectSelection[]\n  smsMarginLedgers           SmsMarginLedger[]');
}

fs.writeFileSync('prisma/schema.prisma', schema);
