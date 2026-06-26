import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const client = readFileSync(join(process.cwd(), "src/components/messaging/messages-client.tsx"), "utf8");
const service = readFileSync(join(process.cwd(), "src/lib/services/messaging.service.ts"), "utf8");

assert(client.includes('import { ClassVoiceRoom }'), "MessagesClient imports ClassVoiceRoom component");
assert(client.includes('activeType === "GROUP" && activeClassId'), "MessagesClient mounts class voice only for class group conversations");
assert(client.includes("conversationId={active}") && client.includes("conversationTitle={activeTitle}"), "MessagesClient passes active conversation id and title into ClassVoiceRoom");
assert(client.includes("setActiveClassId(json.data.conversation.classId || null)"), "MessagesClient stores active class id from thread payload");
assert(service.includes("classId: c.classId"), "conversation list API returns classId for class group detection");
assert(service.includes("conversation: { id: convo.id, type: convo.type, title: convo.title, classId: convo.classId }"), "thread API returns classId for active class voice rendering");
assert(!client.includes("Simulating Audio Recording") && !client.includes("sample-audio.mp3"), "old fake/simulated voice-note sender is removed from MessagesClient");
assert(client.includes("This old disappearing voice note has been replaced by live class voice rooms"), "legacy disappearing note display is storage-safe and points to live class voice rooms");

console.log("\nI.9 class voice Messages integration test passed.");
