const fs = require('fs');
let code = fs.readFileSync('src/app/api/analytics/advanced/route.ts', 'utf8');

if (!code.includes('requirePremiumFeature')) {
  code = code.replace(
    'import { requirePermission } from "@/lib/core/session";',
    'import { requirePermission } from "@/lib/core/session";\nimport { requirePremiumFeature, TierGatingError } from "@/lib/services/tier-gating.service";'
  );

  code = code.replace(
    'const user = await requirePermission("reports.view"); // Principal/Leadership level',
    'const user = await requirePermission("reports.view"); // Principal/Leadership level\n    await requirePremiumFeature(user.tenantId, "advanced_analytics");'
  );

  code = code.replace(
    'return handleError(error);',
    `if (error instanceof TierGatingError) {
      return fail("PAYMENT_REQUIRED", error.message, 402);
    }
    return handleError(error);`
  );

  fs.writeFileSync('src/app/api/analytics/advanced/route.ts', code);
}
