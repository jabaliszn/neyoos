import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { saveIntegrationCredential } from "../src/lib/services/integration-credentials.service";
import { getVapidConfig } from "../src/lib/notifications/push";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const push = readFileSync(join(process.cwd(), "src/lib/notifications/push.ts"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/notifications/native-subscription/route.ts"), "utf8");
  const vault = readFileSync(join(process.cwd(), "src/lib/services/integration-credentials.service.ts"), "utf8");

  assert(push.includes("readCompanySecret") && push.includes("vapid_public_key") && push.includes("vapid_private_key") && push.includes("vapid_subject"), "Push transport reads VAPID credentials from NEYO Ops vault");
  assert(push.includes("webpush.setVapidDetails") && push.includes("vapid.publicKey") && push.includes("vapid.privateKey"), "Push transport uses vault VAPID keys for web-push send");
  assert(route.includes("getVapidConfig") && !route.includes("NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null"), "Native subscription API returns vault VAPID public key, not only env key");
  assert(vault.includes("vapid_subject"), "Integration vault includes VAPID subject credential");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(actor, "SUPER_ADMIN actor exists");
  const keys = ["vapid_public_key", "vapid_private_key", "vapid_subject"];
  const old = await db.neyoIntegrationSecret.findMany({ where: { key: { in: keys } } });
  try {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    await saveIntegrationCredential(actor!, { key: "vapid_public_key", value: "BTestPublicKeyForVault" });
    await saveIntegrationCredential(actor!, { key: "vapid_private_key", value: "TestPrivateKeyForVault" });
    await saveIntegrationCredential(actor!, { key: "vapid_subject", value: "mailto:alerts@neyo.co.ke" });
    const config = await getVapidConfig();
    assert(config.publicKey === "BTestPublicKeyForVault" && config.privateKey === "TestPrivateKeyForVault" && config.subject === "mailto:alerts@neyo.co.ke" && config.configured, "getVapidConfig returns encrypted vault VAPID values");
  } finally {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    for (const row of old) await db.neyoIntegrationSecret.create({ data: row as any });
  }

  console.log("\nI.60 Web Push / VAPID from Vault test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
