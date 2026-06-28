const fs = require('fs');
let code = fs.readFileSync('src/lib/notifications/sms.ts', 'utf8');

// Ensure trackSmsMargin handles the new DB model correctly
// Wait, the sendSms signature is export async function sendSms(to: string, message: string)
// We need it to take tenantId

const oldSig = `export async function sendSms(to: string, message: string) {`;
const newSig = `export async function sendSms(to: string, message: string, tenantId?: string) {`;

code = code.replace(oldSig, newSig);

fs.writeFileSync('src/lib/notifications/sms.ts', code);
