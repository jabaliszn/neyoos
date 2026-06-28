const fs = require('fs');
let code = fs.readFileSync('src/lib/notifications/sms.ts', 'utf8');

// I need to ensure the `trackSmsMargin` function is actually being called. 
// Previously I patched it near `db.usageCounter.update`. But the fake mock SMS sender early returns before that!

const marginLogic = `
  if (tenantId) {
    try {
      const costPerSms = 0.8;
      const pricePerSms = 1.2;
      const margin = (pricePerSms - costPerSms) * 1; // 1 message
      
      await db.smsMarginLedger.create({
        data: {
          tenantId,
          messageCount: 1,
          costPerSmsKes: costPerSms,
          pricePerSmsKes: pricePerSms,
          marginKes: margin,
          status: "UNBILLED"
        }
      });
    } catch (e) {
      console.error(e);
    }
  }
`;

code = code.replace(
  'console.log(`[SMS → ${formattedPhone}]\\n${message}\\n`);',
  'console.log(`[SMS → ${formattedPhone}]\\n${message}\\n`);\n' + marginLogic
);

fs.writeFileSync('src/lib/notifications/sms.ts', code);
