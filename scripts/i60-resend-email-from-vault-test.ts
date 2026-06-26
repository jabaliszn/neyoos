import { db } from "../src/lib/db";
import { saveIntegrationCredential } from "../src/lib/services/integration-credentials.service";
import { sendEmail } from "../src/lib/notifications/email";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const emailSource = readFileSync(join(process.cwd(), "src/lib/notifications/email.ts"), "utf8");
  const vault = readFileSync(join(process.cwd(), "src/lib/services/integration-credentials.service.ts"), "utf8");

  assert(emailSource.includes("readCompanySecret") && emailSource.includes("resend_api_key") && emailSource.includes("resend_from_email"), "Email transport reads Resend credentials from NEYO Ops vault");
  assert(emailSource.includes("https://api.resend.com/emails") && emailSource.includes("Authorization: `Bearer ${apiKey}`"), "Email transport sends through Resend API when key exists");
  assert(emailSource.includes("dev-console") && emailSource.includes("NODE_ENV !== \"production\""), "Email transport keeps safe dev-console fallback outside production");
  assert(vault.includes("resend_api_key") && vault.includes("resend_from_email"), "Integration vault includes Resend API key and sender email");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(actor, "SUPER_ADMIN actor exists");
  const keys = ["resend_api_key", "resend_from_email"];
  const old = await db.neyoIntegrationSecret.findMany({ where: { key: { in: keys } } });
  const originalFetch = global.fetch;
  try {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    await saveIntegrationCredential(actor!, { key: "resend_api_key", value: "re_test_vault_key" });
    await saveIntegrationCredential(actor!, { key: "resend_from_email", value: "NEYO <hello@neyo.co.ke>" });

    let captured: any = null;
    global.fetch = (async (url: any, init: any) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({ id: "email_test_123" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as any;

    const result = await sendEmail("founder@example.com", "NEYO test", "Hello from vault");
    assert(result.ok && result.provider === "resend" && result.messageId === "email_test_123", "sendEmail returns Resend success when vault key exists");
    assert(captured.url === "https://api.resend.com/emails", "sendEmail posts to Resend endpoint");
    assert(captured.init.headers.Authorization === "Bearer re_test_vault_key", "sendEmail uses vault API key in Authorization header");
    const payload = JSON.parse(captured.init.body);
    assert(payload.from === "NEYO <hello@neyo.co.ke>" && payload.to === "founder@example.com" && payload.text === "Hello from vault", "sendEmail uses vault sender and sends text payload");
  } finally {
    global.fetch = originalFetch;
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    for (const row of old) await db.neyoIntegrationSecret.create({ data: row as any });
  }

  console.log("\nI.60 Resend Email from Vault test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
