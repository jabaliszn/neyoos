const fs = require('fs');
let code = fs.readFileSync('src/lib/notifications/sms.ts', 'utf8');

const oldMockSend = `  if (!config.apiKey) {
    console.log(\`\\n[SMS → \${to}]\\n\${finalMessage}\\n\`);
    return {
      ok: process.env.NODE_ENV !== "production",
      provider: "dev-console",
      messageId: \`dev_\${Date.now()}\`,
    };
  }`;

const newMockSend = `  if (!config.apiKey) {
    console.log(\`\\n[SMS → \${to}]\\n\${finalMessage}\\n\`);
    if (options?.tenantId) {
      const costPerSms = 0.8;
      const pricePerSms = 1.2;
      await db.smsMarginLedger.create({
        data: {
          tenantId: options.tenantId,
          messageCount: 1,
          costPerSmsKes: costPerSms,
          pricePerSmsKes: pricePerSms,
          marginKes: (pricePerSms - costPerSms) * 1,
          status: "UNBILLED"
        }
      });
    }
    return {
      ok: process.env.NODE_ENV !== "production",
      provider: "dev-console",
      messageId: \`dev_\${Date.now()}\`,
    };
  }`;

code = code.replace(oldMockSend, newMockSend);
fs.writeFileSync('src/lib/notifications/sms.ts', code);
