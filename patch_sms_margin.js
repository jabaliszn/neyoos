const fs = require('fs');
let code = fs.readFileSync('src/lib/notifications/sms.ts', 'utf8');

const marginLogic = `
import { db } from "@/lib/db";

// M.2 SMS Margin tracking
async function trackSmsMargin(tenantId: string | undefined, messageCount: number) {
  if (!tenantId) return;
  try {
    const costPerSms = 0.8;
    const pricePerSms = 1.2;
    const margin = (pricePerSms - costPerSms) * messageCount;
    
    await db.smsMarginLedger.create({
      data: {
        tenantId,
        messageCount,
        costPerSmsKes: costPerSms,
        pricePerSmsKes: pricePerSms,
        marginKes: margin,
        status: "UNBILLED"
      }
    });
  } catch (e) {
    console.error("Failed to track SMS margin", e);
  }
}
`;

if (!code.includes('trackSmsMargin')) {
  code = code.replace(
    'import { formatPhoneKE } from "@/lib/utils";',
    'import { formatPhoneKE } from "@/lib/utils";\n' + marginLogic
  );

  const search = `await db.usageCounter.update({
        where: { id: counter.id },
        data: { count: { increment: 1 } },
      });`;

  code = code.replace(
    search,
    `${search}\n      await trackSmsMargin(tenantId, 1);`
  );

  fs.writeFileSync('src/lib/notifications/sms.ts', code);
}
