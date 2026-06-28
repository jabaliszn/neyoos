const fs = require('fs');
let code = fs.readFileSync('src/lib/services/subject-selection.service.ts', 'utf8');

const createFunction = `
import { type CreateSelectionPortalInput } from "@/lib/validations/subject-selection";

// Academics creation endpoint
export async function createSelectionPortal(user: SessionUser, input: CreateSelectionPortalInput) {
  const tDb = tenantDb();
  
  if (!["PRINCIPAL", "DEPUTY_PRINCIPAL", "SUPER_ADMIN", "HOD"].includes(user.role)) {
    throw new SelectionError("FORBIDDEN", "Only Academics leadership can configure subject selection portals.");
  }

  // Ensure no overlapping active portals for the same level
  const existing = await tDb.subjectSelectionPortal.findFirst({
    where: { 
      targetLevel: input.targetLevel, 
      status: "OPEN",
      closeDate: { gt: new Date() }
    }
  });

  if (existing) {
    throw new SelectionError("CONFLICT", \`An active selection portal already exists for \${input.targetLevel}.\`);
  }

  return tDb.subjectSelectionPortal.create({
    data: {
      tenantId: user.tenantId,
      name: input.name,
      targetLevel: input.targetLevel,
      openDate: input.openDate,
      closeDate: input.closeDate,
      status: "OPEN",
      rulesJson: JSON.stringify(input.rules)
    }
  });
}

// Academics listing endpoint
export async function listAllSelectionPortals(user: SessionUser) {
  return tenantDb().subjectSelectionPortal.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { selections: true } } }
  });
}
`;

if (!code.includes('createSelectionPortal')) {
  code = code.replace(
    'export class SelectionError',
    `${createFunction}\nexport class SelectionError`
  );
  fs.writeFileSync('src/lib/services/subject-selection.service.ts', code);
}
