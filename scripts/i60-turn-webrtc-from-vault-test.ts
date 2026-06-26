import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { saveIntegrationCredential } from "../src/lib/services/integration-credentials.service";
import { getWebRtcIceServers } from "../src/lib/services/webrtc-config.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const service = readFileSync(join(process.cwd(), "src/lib/services/webrtc-config.service.ts"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/webrtc/ice/route.ts"), "utf8");
  const online = readFileSync(join(process.cwd(), "src/components/online-classes/online-class-room-client.tsx"), "utf8");
  const voice = readFileSync(join(process.cwd(), "src/components/messaging/class-voice-room.tsx"), "utf8");
  const vault = readFileSync(join(process.cwd(), "src/lib/services/integration-credentials.service.ts"), "utf8");

  assert(service.includes("readCompanySecret") && service.includes("turn_server_url") && service.includes("turn_server_username") && service.includes("turn_server_secret"), "WebRTC service reads TURN credentials from NEYO Ops vault");
  assert(route.includes("requireUser") && route.includes("getWebRtcIceServers"), "Signed-in API exposes ICE servers safely");
  assert(online.includes("/api/webrtc/ice") && online.includes("new RTCPeerConnection({ iceServers })"), "Online Classes client uses vault-backed ICE servers");
  assert(voice.includes("/api/webrtc/ice") && voice.includes("new RTCPeerConnection({ iceServers })"), "Class Voice Room client uses vault-backed ICE servers");
  assert(vault.includes("stun_server_url") && vault.includes("turn_server_username"), "Integration vault includes STUN/TURN URL, username and secret fields");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(actor, "SUPER_ADMIN actor exists");
  const keys = ["stun_server_url", "turn_server_url", "turn_server_username", "turn_server_secret"];
  const old = await db.neyoIntegrationSecret.findMany({ where: { key: { in: keys } } });
  try {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    await saveIntegrationCredential(actor!, { key: "stun_server_url", value: "stun:stun.neyo.co.ke:3478" });
    await saveIntegrationCredential(actor!, { key: "turn_server_url", value: "turn:turn.neyo.co.ke:3478" });
    await saveIntegrationCredential(actor!, { key: "turn_server_username", value: "neyo-turn" });
    await saveIntegrationCredential(actor!, { key: "turn_server_secret", value: "turn-secret" });
    const cfg = await getWebRtcIceServers();
    assert(cfg.turnConfigured === true && cfg.iceServers.length === 2, "ICE config includes STUN and TURN when vault credentials exist");
    const turn = cfg.iceServers.find((s: any) => String(s.urls).startsWith("turn:")) as any;
    assert(turn.username === "neyo-turn" && turn.credential === "turn-secret", "TURN server uses vault username and secret");
  } finally {
    await db.neyoIntegrationSecret.deleteMany({ where: { key: { in: keys } } });
    for (const row of old) await db.neyoIntegrationSecret.create({ data: row as any });
  }

  console.log("\nI.60 TURN/WebRTC from Vault test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
