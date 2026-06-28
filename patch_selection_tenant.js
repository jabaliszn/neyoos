const fs = require('fs');
let code = fs.readFileSync('src/lib/services/subject-selection.service.ts', 'utf8');

if (!code.includes('import { withTenant }')) {
  code = code.replace(
    'import { tenantDb } from "@/lib/core/tenant-db";',
    'import { tenantDb } from "@/lib/core/tenant-db";\nimport { withTenant } from "@/lib/core/tenant-context";'
  );
  
  code = code.replace(
    'export async function createSelectionPortal(user: SessionUser, input: CreateSelectionPortalInput) {',
    'export async function createSelectionPortal(user: SessionUser, input: CreateSelectionPortalInput) {\n  return withTenant(user.tenantId, async () => {'
  );
  code = code.replace(
    /return tDb\.subjectSelectionPortal\.create\(\{[\s\S]*?\}\);\n}/,
    '$&\n  });\n}'
  );

  code = code.replace(
    'export async function listAllSelectionPortals(user: SessionUser) {',
    'export async function listAllSelectionPortals(user: SessionUser) {\n  return withTenant(user.tenantId, async () => {'
  );
  code = code.replace(
    /return tenantDb\(\)\.subjectSelectionPortal\.findMany\(\{[\s\S]*?\}\);\n}/,
    '$&\n  });\n}'
  );

  code = code.replace(
    'export async function getActiveSelectionPortals(user: SessionUser, level?: string) {',
    'export async function getActiveSelectionPortals(user: SessionUser, level?: string) {\n  return withTenant(user.tenantId, async () => {'
  );
  code = code.replace(
    /return tDb\.subjectSelectionPortal\.findMany\(\{[\s\S]*?\}\);\n}/,
    '$&\n  });\n}'
  );

  code = code.replace(
    'export async function submitStudentSelections(user: SessionUser, portalId: string, studentId: string, selectedSubjectIds: string[]) {',
    'export async function submitStudentSelections(user: SessionUser, portalId: string, studentId: string, selectedSubjectIds: string[]) {\n  return withTenant(user.tenantId, async () => {'
  );
  code = code.replace(
    /return tDb\.studentSubjectSelection\.upsert\(\{[\s\S]*?\}\);\n}/,
    '$&\n  });\n}'
  );

  code = code.replace(
    'export async function getSelectionReport(user: SessionUser, portalId: string) {',
    'export async function getSelectionReport(user: SessionUser, portalId: string) {\n  return withTenant(user.tenantId, async () => {'
  );
  code = code.replace(
    /return \{ portal, tally, studentSelections \};\n}/,
    '$&\n  });\n}'
  );

  fs.writeFileSync('src/lib/services/subject-selection.service.ts', code);
}
