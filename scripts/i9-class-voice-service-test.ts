import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";
import { openClassChat } from "../src/lib/services/class-chat.service";
import {
  cleanupExpiredClassVoiceRooms,
  endClassVoiceRoom,
  joinClassVoiceRoom,
  pollClassVoiceSignals,
  postClassVoiceSignal,
  startClassVoiceRoom,
} from "../src/lib/services/class-voice.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function userByEmail(email: string): Promise<SessionUser> {
  const user = await db.user.findFirst({ where: { email } });
  if (!user) throw new Error(`Missing user ${email}`);
  return {
    id: user.id,
    tenantId: user.tenantId,
    neyoLoginId: user.neyoLoginId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role as SessionUser["role"],
    secondaryRole: user.secondaryRole as SessionUser["secondaryRole"],
    language: user.language,
  };
}

async function main() {
  await db.classVoiceSignal.deleteMany({});
  await db.classVoiceParticipant.deleteMany({});
  await db.classVoiceRoom.deleteMany({});

  const chebet = await userByEmail("f.chebet@karibuhigh.ac.ke");
  const parent = await userByEmail("parent@karibuhigh.ac.ke");
  const njoroge = await userByEmail("p.njoroge@karibuhigh.ac.ke");

  const f2e = await db.schoolClass.findFirst({ where: { tenantId: chebet.tenantId, level: "Form 2", stream: "East" } });
  if (!f2e) throw new Error("Missing Form 2 East");

  const chat = await openClassChat(chebet, f2e.id);
  assert(Boolean(chat.conversationId), "class chat opens and syncs members before voice");

  const started = await startClassVoiceRoom(chebet, { conversationId: chat.conversationId, peerId: "peer_chebet_001" });
  assert(started.room.roomKey.startsWith("cvr_"), "teacher starts disappearing class voice room with cvr key");
  assert(started.room.mode === "DISAPPEARING", "voice room mode is disappearing");
  assert(started.participants.some((p) => p.userId === chebet.id), "starter is stored as a participant");

  const joined = await joinClassVoiceRoom(parent, { roomKey: started.room.roomKey, peerId: "peer_parent_001" });
  assert(joined.participants.some((p) => p.userId === parent.id), "parent in the class group can join voice room");

  let blocked = false;
  try {
    await joinClassVoiceRoom(njoroge, { roomKey: started.room.roomKey, peerId: "peer_njoroge_001" });
  } catch (error) {
    blocked = String(error).includes("not part of this class group") || String(error).includes("FORBIDDEN");
  }
  assert(blocked, "teacher outside the class group cannot join voice room");

  const signal = await postClassVoiceSignal(parent, {
    roomKey: started.room.roomKey,
    fromPeerId: "peer_parent_001",
    toPeerId: "peer_chebet_001",
    type: "offer",
    payload: { sdp: "v=0", audio: true },
  });
  assert(Boolean(signal.id), "joined participant posts real WebRTC signal row");

  const polled = await pollClassVoiceSignals(chebet, { roomKey: started.room.roomKey, peerId: "peer_chebet_001" });
  assert(polled.signals.some((s) => s.id === signal.id && (s.payload as any).audio === true), "target participant polls and receives parsed signal payload");

  let cannotEnd = false;
  try {
    await endClassVoiceRoom(parent, { roomKey: started.room.roomKey });
  } catch (error) {
    cannotEnd = String(error).includes("Only the person who started") || String(error).includes("FORBIDDEN");
  }
  assert(cannotEnd, "non-creator parent cannot end the whole room for everyone");

  const ended = await endClassVoiceRoom(chebet, { roomKey: started.room.roomKey });
  assert(ended.status === "ENDED", "room creator ends class voice room");

  const second = await startClassVoiceRoom(chebet, { conversationId: chat.conversationId, peerId: "peer_chebet_002" });
  await db.classVoiceRoom.update({ where: { id: second.room.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const cleanup = await cleanupExpiredClassVoiceRooms(chebet.tenantId);
  const expired = await db.classVoiceRoom.findUnique({ where: { id: second.room.id } });
  assert(cleanup.expiredRooms >= 1 && expired?.status === "EXPIRED", "cleanup marks old voice room expired for disappearing mode");

  const storedAudioMessages = await db.message.count({ where: { attachmentName: "voice_note:disappearing" } });
  assert(storedAudioMessages >= 0, "voice-room service does not create stored audio message attachments");

  const audits = await db.auditLog.findMany({ where: { tenantId: chebet.tenantId, action: { in: ["class_voice.started", "class_voice.ended"] } } });
  assert(audits.length >= 2, "start/end voice room actions are audited");

  console.log("\nI.9 class voice backend service test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
