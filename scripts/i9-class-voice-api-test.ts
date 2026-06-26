import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const mainRoute = readFileSync(join(process.cwd(), "src/app/api/class-voice/route.ts"), "utf8");
const signalRoute = readFileSync(join(process.cwd(), "src/app/api/class-voice/signal/route.ts"), "utf8");
const respond = readFileSync(join(process.cwd(), "src/lib/api/respond.ts"), "utf8");

assert(mainRoute.includes("requireUser()"), "class voice action route requires signed-in user");
assert(mainRoute.includes("activeClassVoiceRoom") && mainRoute.includes("conversationId"), "class voice route exposes active room lookup for a class conversation");
assert(mainRoute.includes("classVoiceActionSchema.parse"), "class voice action route validates action payload with Zod");
assert(mainRoute.includes("startClassVoiceRoom") && mainRoute.includes("joinClassVoiceRoom") && mainRoute.includes("endClassVoiceRoom"), "class voice action route wires start/join/end services");
assert(signalRoute.includes("pollClassVoiceSignalsSchema.parse"), "signal GET route validates poll query");
assert(signalRoute.includes("postClassVoiceSignalSchema.parse"), "signal POST route validates WebRTC signal payload");
assert(signalRoute.includes("pollClassVoiceSignals") && signalRoute.includes("postClassVoiceSignal"), "signal route wires poll/post services");
assert(respond.includes("ClassVoiceError") && respond.includes("EXPIRED") && respond.includes("Class group"), "API error responder maps ClassVoiceError gracefully");

console.log("\nI.9 class voice API route wiring test passed.");
