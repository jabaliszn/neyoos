import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { saveIntegrationCredential } from "../src/lib/services/integration-credentials.service";
import { getWhatsAppConfig, sendWhatsApp } from "../src/lib/notifications/whatsapp";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const whatsappSource = readFileSync(join(process.cwd(), "src/lib/notifications/whatsapp.ts"), "utf8");
  const notificationService = readFileSync(join(process.cwd(), "src/lib/services/notification.service.ts"), "utf8");
  const vault = readFileSync(join(process.cwd(), "src/lib/services/integration-credentials.service.ts"), "utf8");

  assert(whatsappSource.includes("readCompanySecret") && whatsappSource.includes("whatsapp_business_token") && whatsappSource.includes("whatsapp_phone_number_id"), "WhatsApp transport reads Cloud API credentials from NEYO Ops vault");
  assert(whatsappSource.includes("graph.facebook.com") && whatsappSource.includes("messaging_product") && whatsappSource.includes("whatsapp"), "WhatsApp transport posts to WhatsApp Cloud API messages endpoint");
  assert(whatsappSource.includes("messageWithSchoolName") && whatsappSource.includes("tenantId"), "WhatsApp transport supports tenant-aware school prefixing");
  assert(notificationService.includes("sendWhatsApp(recipient.phone") && notificationService.includes("tenantId: input.tenantId"), "Notification cascade passes tenant context into WhatsApp transport");
  assert(vault.includes("whatsapp_phone_number_id") && vault.includes("whatsapp_api_version"), "Integration vault includes WhatsApp phone number ID and API version");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  const tenant = await db.tenant.findFirst({ orderBy: { onboardedAt: "asc" } });
  assert(actor && tenant, "SUPER_ADMIN and tenant exist");
  const keys = ["whatsapp_business_token", "whatsapp_phone_number_id", "whatsapp_api_version"];
  const old = await db.neyoIntegrationSecret.findMany({ where: { key: { in: keys } } });
  const originalFetch = global.fetch;
  try {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    await saveIntegrationCredential(actor!, { key: "whatsapp_business_token", value: "WA-test-token" });
    await saveIntegrationCredential(actor!, { key: "whatsapp_phone_number_id", value: "1234567890" });
    await saveIntegrationCredential(actor!, { key: "whatsapp_api_version", value: "v20.0" });
    const config = await getWhatsAppConfig();
    assert(config.configured && config.token === "WA-test-token" && config.phoneNumberId === "1234567890", "getWhatsAppConfig returns encrypted vault WhatsApp values");

    let captured: any = null;
    global.fetch = (async (url: any, init: any) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as any;

    const result = await sendWhatsApp("0712345678", "Parent reminder for payment", { tenantId: tenant!.id });
    assert(result.ok && result.provider === "whatsapp-business" && result.messageId === "wamid.test", "sendWhatsApp returns WhatsApp Business success when vault key exists");
    assert(captured.url === "https://graph.facebook.com/v20.0/1234567890/messages", "sendWhatsApp posts to vault phone number endpoint");
    assert(captured.init.headers.Authorization === "Bearer WA-test-token", "sendWhatsApp uses vault WhatsApp token");
    const payload = JSON.parse(captured.init.body);
    assert(payload.to === "254712345678" && payload.type === "text", "sendWhatsApp normalizes Kenyan phone and sends text message");
    assert(payload.text.body.startsWith(`${tenant!.name}:`), "sendWhatsApp prefixes tenant-specific school name when tenantId is provided");

    captured = null;
    await sendWhatsApp("0712345678", "NEYO system notice", { tenantId: tenant!.id, prefix: false });
    const payload2 = JSON.parse(captured.init.body);
    assert(!payload2.text.body.startsWith(`${tenant!.name}:`), "sendWhatsApp can disable prefixing for system messages");
  } finally {
    global.fetch = originalFetch;
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    for (const row of old) await db.neyoIntegrationSecret.create({ data: row as any });
  }

  console.log("\nI.60 WhatsApp Business from Vault test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
