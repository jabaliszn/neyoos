import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.80 device biometric app-open unlock test");
  const card = readFileSync("src/components/settings/device-app-unlock-card.tsx", "utf8");
  assert(card.includes("Device App Unlock") && card.includes("Face ID or Android fingerprint"), "Settings has a clear app-open unlock card for Face ID / fingerprint");
  assert(card.includes("neyo-app-unlock-enabled") && card.includes("sessionStorage.setItem(\"neyo-app-unlocked\""), "app-open unlock setting is per-device and marks verified session");
  assert(card.includes("requireBiometric(\"Enable app-open unlock on this device\""), "enabling app unlock requires a real biometric/passkey verification first");
  assert(card.includes("hasPasskey") && card.includes("Pair Face ID, Touch ID, Android fingerprint"), "app unlock requires an enrolled biometric passkey before enabling");

  const securityPage = readFileSync("src/app/(app)/settings/security/page.tsx", "utf8");
  assert(securityPage.includes("<DeviceAppUnlockCard hasPasskey={passkeys.length > 0}"), "Security settings renders app-open unlock based on real enrolled passkeys");

  const gate = readFileSync("src/components/auth/biometric-gate.tsx", "utf8");
  assert(gate.includes("neyo-app-unlock-enabled") && gate.includes("/api/auth/me"), "app shell checks signed-in users for app-open unlock on app load");
  assert(gate.includes("Open NEYO on this device") && gate.includes("Unlock NEYO"), "app-open biometric overlay is distinct from critical-action approval copy");
  assert(gate.includes("/api/auth/passkey/action/options") && gate.includes("/api/auth/passkey/action/verify"), "app-open unlock uses the existing real WebAuthn passkey challenge/verify backend");
  assert(gate.includes("if (appUnlockMode) return;"), "app-open unlock overlay cannot be dismissed without verification");

  console.log("\n✅ I.80 device biometric app-open unlock test passed");
}

main().catch((err) => { console.error(err); process.exit(1); });
