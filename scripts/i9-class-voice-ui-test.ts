import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const source = readFileSync(join(process.cwd(), "src/components/messaging/class-voice-room.tsx"), "utf8");

assert(source.includes("export function ClassVoiceRoom"), "ClassVoiceRoom component is exported");
assert(source.includes("/api/class-voice") && source.includes("/api/class-voice/signal"), "component uses real class voice API endpoints");
assert(source.includes("navigator.mediaDevices.getUserMedia"), "component requests real microphone access");
assert(source.includes("RTCPeerConnection"), "component uses browser peer connection APIs for live voice");
assert(source.includes("createOffer") && source.includes("createAnswer") && source.includes("RTCIceCandidate"), "component handles offer, answer and ICE signals");
assert(source.includes("No class voice is saved by NEYO"), "component explains no voice is stored");
assert(source.includes("Phone") && source.includes("Mic") && source.includes("PhoneOff") && source.includes("ShieldCheck") && source.includes("Clock"), "component uses the required Lucide voice/status icons");
assert(!source.includes("audioUrl") && !source.includes("recordingUrl"), "component does not send stored audio/recording URLs");

console.log("\nI.9 class voice UI component test passed.");
