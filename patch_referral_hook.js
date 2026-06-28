const fs = require('fs');
let code = fs.readFileSync('src/lib/services/finance.service.ts', 'utf8');

const oldReturn = `    return updated;
  });
}`;

const newReturn = `
    // M.1 Trigger Referral Rewards on payment
    try {
      const { processReferralRewards } = await import("./referral.service");
      await processReferralRewards(user.tenantId);
    } catch { /* best-effort */ }

    return updated;
  });
}`;

if (!code.includes('processReferralRewards')) {
  code = code.replace(oldReturn, newReturn);
  fs.writeFileSync('src/lib/services/finance.service.ts', code);
}
