import { db } from "@/lib/db";
import { loginWithPassword } from "@/lib/services/auth.service";
import { getActionAssertionOptions } from "@/lib/services/passkey.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("I.1/I.39/I.40 auth security smoke test");

  const deviceId = `dev_testDeviceBinding_${Date.now()}_abcdefghijklmnop`;
  const result = await loginWithPassword("principal@karibuhigh.ac.ke", "Karibu2026!", {
    userAgent: "i1-auth-security-test",
    ipAddress: "127.0.0.1",
    deviceId,
  });

  const session = await db.session.findUnique({ where: { token: result.sessionToken } });
  assert(Boolean(session), "email/password login creates a real session");
  assert(session?.deviceId === deviceId, "new login session is bound to the physical device ID");

  const user = await db.user.findFirst({ where: { email: "principal@karibuhigh.ac.ke" } });
  assert(Boolean(user), "principal test user exists");

  let passkeySetupRequired = false;
  try {
    await getActionAssertionOptions(user!.id);
  } catch (err) {
    passkeySetupRequired = err instanceof Error && err.message.includes("Settings → Security");
  }
  assert(passkeySetupRequired, "critical-action passkey gate refuses fake verification when no passkey is enrolled");

  await db.session.delete({ where: { token: result.sessionToken } }).catch(() => {});
  console.log("\n✅ auth security smoke test passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
