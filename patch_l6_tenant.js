const fs = require('fs');
let code = fs.readFileSync('src/lib/services/opening-day.service.ts', 'utf8');

code = code.replace(
  'export async function runOpeningDayGhostSweep(user: SessionUser, openingDate: string) {',
  'import { withTenant } from "@/lib/core/tenant-context";\nexport async function runOpeningDayGhostSweep(user: SessionUser, openingDate: string) {\n  return withTenant(user.tenantId, async () => {'
);
code = code.replace(
  'return { success: true, ghostsFlagged: ghostedCount };\n}',
  'return { success: true, ghostsFlagged: ghostedCount };\n  });\n}'
);

fs.writeFileSync('src/lib/services/opening-day.service.ts', code);
