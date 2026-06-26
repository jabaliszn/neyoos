import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { saveIntegrationCredential } from "../src/lib/services/integration-credentials.service";
import { sendSms } from "../src/lib/notifications/sms";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const smsSource = readFileSync(join(process.cwd(), "src/lib/notifications/sms.ts"), "utf8");
  const notificationService = readFileSync(join(process.cwd(), "src/lib/services/notification.service.ts"), "utf8");
  const authService = readFileSync(join(process.cwd(), "src/lib/services/auth.service.ts"), "utf8");
  const vault = readFileSync(join(process.cwd(), "src/lib/services/integration-credentials.service.ts"), "utf8");

  assert(smsSource.includes("readCompanySecret") && smsSource.includes("africas_talking_api_key") && smsSource.includes("africas_talking_username"), "SMS transport reads Africa's Talking credentials from NEYO Ops vault");
  assert(smsSource.includes("messageWithSchoolName") && smsSource.includes("tenantId") && smsSource.includes("schoolName"), "SMS transport supports tenant-aware school name prefixing");
  assert(smsSource.includes("https://api.africastalking.com/version1/messaging") && smsSource.includes("application/x-www-form-urlencoded"), "SMS transport posts to Africa's Talking messaging API");
  assert(notificationService.includes("sendSms(recipient.phone") && notificationService.includes("tenantId: input.tenantId"), "Notification cascade passes tenant context into SMS transport");
  assert(authService.includes("prefix: false"), "OTP login SMS disables school prefixing");
  assert(vault.includes("africas_talking_sender_id"), "Integration vault includes Africa's Talking sender ID");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  const tenant = await db.tenant.findFirst({ orderBy: { onboardedAt: "asc" } });
  assert(actor && tenant, "SUPER_ADMIN and tenant exist");
  const keys = ["africas_talking_api_key", "africas_talking_username", "africas_talking_sender_id"];
  const old = await db.neyoIntegrationSecret.findMany({ where: { key: { in: keys } } });
  const originalFetch = global.fetch;
  try {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    await saveIntegrationCredential(actor!, { key: "africas_talking_api_key", value: "AT-test-key" });
    await saveIntegrationCredential(actor!, { key: "africas_talking_username", value: "neyo" });
    await saveIntegrationCredential(actor!, { key: "africas_talking_sender_id", value: "NEYO" });

    let captured: any = null;
    global.fetch = (async (url: any, init: any) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({ SMSMessageData: { Message: "Sent", Recipients: [{ status: "Success", messageId: "AT-123" }] } }), { status: 201, headers: { "Content-Type": "application/json" } });
    }) as any;

    const result = await sendSms("+254700111222", "Fee reminder for invoice INV-001", { tenantId: tenant!.id });
    assert(result.ok && result.provider === "africas-talking" && result.messageId === "AT-123", "sendSms returns Africa's Talking success when vault key exists");
    assert(captured.url === "https://api.africastalking.com/version1/messaging", "sendSms posts to Africa's Talking endpoint");
    assert(captured.init.headers.apiKey === "AT-test-key", "sendSms uses vault API key header");
    const body = new URLSearchParams(captured.init.body);
    assert(body.get("username") === "neyo" && body.get("from") === "NEYO", "sendSms uses vault username and sender ID");
    assert(body.get("message")?.startsWith(`${tenant!.name}:`), "sendSms prefixes tenant-specific school name when tenantId is provided");

    captured = null;
    await sendSms("+254700111222", "Your NEYO login code is 123456", { tenantId: tenant!.id, prefix: false });
    const body2 = new URLSearchParams(captured.init.body);
    assert(!body2.get("message")?.startsWith(`${tenant!.name}:`), "sendSms does not prefix OTP/system messages when prefix=false");
  } finally {
    global.fetch = originalFetch;
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    for (const row of old) await db.neyoIntegrationSecret.create({ data: row as any });
  }

  console.log("\nI.60 Africa's Talking SMS from Vault test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
