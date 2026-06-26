import {
  CLASS_VOICE_ROOM_TTL_MINUTES,
  CLASS_VOICE_SIGNAL_TTL_MINUTES,
  joinClassVoiceRoomSchema,
  pollClassVoiceSignalsSchema,
  postClassVoiceSignalSchema,
  startClassVoiceRoomSchema,
} from "../src/lib/validations/class-voice";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function rejects(fn: () => unknown, message: string) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  assert(failed, message);
}

const peerId = "peer_teacher_001";
const roomKey = "cvr_testroom_001";

startClassVoiceRoomSchema.parse({ conversationId: "conversation_1", peerId });
assert(true, "start schema accepts class conversation id and safe peer id");

joinClassVoiceRoomSchema.parse({ roomKey, peerId });
assert(true, "join schema accepts valid disappearing room key");

postClassVoiceSignalSchema.parse({
  roomKey,
  fromPeerId: peerId,
  toPeerId: "peer_parent_002",
  type: "offer",
  payload: { sdp: "v=0", audio: true },
});
assert(true, "signal schema accepts WebRTC offer payload metadata");

pollClassVoiceSignalsSchema.parse({ roomKey, peerId, sinceId: null });
assert(true, "poll schema accepts nullable since id");

rejects(
  () => startClassVoiceRoomSchema.parse({ conversationId: "conversation_1", peerId, audioUrl: "https://example.com/a.mp3" }),
  "start schema rejects stored audio URL extras"
);

rejects(
  () => postClassVoiceSignalSchema.parse({ roomKey, fromPeerId: peerId, type: "offer", payload: { audioUrl: "https://example.com/a.mp3" } }),
  "signal schema rejects audio URL payloads"
);

rejects(
  () => postClassVoiceSignalSchema.parse({ roomKey, fromPeerId: peerId, type: "recording", payload: {} }),
  "signal schema rejects non-WebRTC recording signal type"
);

rejects(
  () => joinClassVoiceRoomSchema.parse({ roomKey: "bad-room", peerId }),
  "join schema rejects malformed room keys"
);

assert(CLASS_VOICE_ROOM_TTL_MINUTES <= 15, "room ttl is short-lived for disappearing mode");
assert(CLASS_VOICE_SIGNAL_TTL_MINUTES <= 20, "signal ttl is short-lived for disappearing mode");

console.log("\nI.9 class voice validation/security checks passed.");
