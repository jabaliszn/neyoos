import crypto from "node:crypto";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { createInApp } from "@/lib/services/notification.service";
import {
  CLASS_VOICE_MODE,
  CLASS_VOICE_ROOM_TTL_MINUTES,
  CLASS_VOICE_SIGNAL_TTL_MINUTES,
  type JoinClassVoiceRoomInput,
  type PostClassVoiceSignalInput,
  type PollClassVoiceSignalsInput,
  type StartClassVoiceRoomInput,
} from "@/lib/validations/class-voice";

export class ClassVoiceError extends Error {
  constructor(
    public code: "NOT_FOUND" | "FORBIDDEN" | "STATE" | "EXPIRED" | "INVALID",
    message: string
  ) {
    super(message);
    this.name = "ClassVoiceError";
  }
}

const leadershipRoles = new Set<Role>([
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PRINCIPAL",
  "DEPUTY_PRINCIPAL",
  "DEAN_OF_STUDIES",
  "HOD",
]);

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function parsePayload(payload: string) {
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function classVoiceRoomKey() {
  return `cvr_${crypto.randomBytes(18).toString("base64url")}`;
}

function userRoles(user: SessionUser): Role[] {
  return [user.role, user.secondaryRole].filter(Boolean) as Role[];
}

function canEndRoom(user: SessionUser, room: { createdById: string }) {
  return room.createdById === user.id || userRoles(user).some((role) => leadershipRoles.has(role));
}

async function requireClassConversation(tenantId: string, conversationId: string) {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, tenantId },
    include: { participants: true },
  });
  if (!conversation || !conversation.classId || conversation.type !== "GROUP") {
    throw new ClassVoiceError("NOT_FOUND", "Class group conversation not found.");
  }
  return conversation;
}

async function requireConversationParticipant(conversationId: string, userId: string) {
  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) {
    throw new ClassVoiceError("FORBIDDEN", "You are not part of this class group.");
  }
  return participant;
}

async function requireActiveRoom(tenantId: string, roomKey: string) {
  const room = await db.classVoiceRoom.findFirst({ where: { tenantId, roomKey } });
  if (!room) throw new ClassVoiceError("NOT_FOUND", "Class voice room not found.");
  if (room.status !== "ACTIVE") throw new ClassVoiceError("STATE", "This class voice room is no longer active.");
  if (room.expiresAt.getTime() <= Date.now()) {
    await db.classVoiceRoom.update({
      where: { id: room.id },
      data: { status: "EXPIRED", endedAt: new Date() },
    });
    throw new ClassVoiceError("EXPIRED", "This class voice room has disappeared.");
  }
  return room;
}

async function upsertParticipant(input: {
  tenantId: string;
  roomId: string;
  user: SessionUser;
  peerId: string;
}) {
  return db.classVoiceParticipant.upsert({
    where: { roomId_userId: { roomId: input.roomId, userId: input.user.id } },
    update: {
      peerId: input.peerId,
      userName: input.user.fullName,
      role: input.user.role,
      lastSeenAt: new Date(),
      leftAt: null,
    },
    create: {
      tenantId: input.tenantId,
      roomId: input.roomId,
      userId: input.user.id,
      userName: input.user.fullName,
      role: input.user.role,
      peerId: input.peerId,
    },
  });
}

async function roomSnapshot(roomId: string) {
  const [room, participants] = await Promise.all([
    db.classVoiceRoom.findUnique({ where: { id: roomId } }),
    db.classVoiceParticipant.findMany({
      where: { roomId, leftAt: null },
      orderBy: { joinedAt: "asc" },
    }),
  ]);
  if (!room) throw new ClassVoiceError("NOT_FOUND", "Class voice room not found.");
  return { room, participants };
}

async function createRoomSignal(input: {
  tenantId: string;
  roomId: string;
  fromPeerId: string;
  toPeerId?: string | null;
  type: string;
  payload: unknown;
}) {
  return db.classVoiceSignal.create({
    data: {
      tenantId: input.tenantId,
      roomId: input.roomId,
      fromPeerId: input.fromPeerId,
      toPeerId: input.toPeerId || null,
      type: input.type,
      payload: JSON.stringify(input.payload ?? {}),
      expiresAt: minutesFromNow(CLASS_VOICE_SIGNAL_TTL_MINUTES),
    },
  });
}

export async function cleanupExpiredClassVoiceRooms(tenantId?: string) {
  const now = new Date();
  const where = tenantId ? { tenantId } : {};
  const expired = await db.classVoiceRoom.findMany({
    where: { ...where, status: "ACTIVE", expiresAt: { lte: now } },
    select: { id: true },
    take: 200,
  });
  const expiredIds = expired.map((room) => room.id);
  if (expiredIds.length) {
    await db.classVoiceRoom.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: "EXPIRED", endedAt: now },
    });
    await db.classVoiceParticipant.updateMany({
      where: { roomId: { in: expiredIds }, leftAt: null },
      data: { leftAt: now },
    });
  }

  const deletedSignals = await db.classVoiceSignal.deleteMany({
    where: { ...where, expiresAt: { lte: now } },
  });

  return { expiredRooms: expiredIds.length, deletedSignals: deletedSignals.count };
}

export async function activeClassVoiceRoom(user: SessionUser, conversationId: string) {
  return withTenant(user.tenantId, async () => {
    await cleanupExpiredClassVoiceRooms(user.tenantId);
    const conversation = await requireClassConversation(user.tenantId, conversationId);
    await requireConversationParticipant(conversation.id, user.id);

    const room = await tenantDb().classVoiceRoom.findFirst({
      where: {
        conversationId: conversation.id,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!room) return { room: null, participants: [] };
    const participants = await tenantDb().classVoiceParticipant.findMany({
      where: { roomId: room.id, leftAt: null },
      orderBy: { joinedAt: "asc" },
    });
    return { room, participants };
  });
}

export async function startClassVoiceRoom(user: SessionUser, input: StartClassVoiceRoomInput) {
  return withTenant(user.tenantId, async () => {
    await cleanupExpiredClassVoiceRooms(user.tenantId);
    const conversation = await requireClassConversation(user.tenantId, input.conversationId);
    await requireConversationParticipant(conversation.id, user.id);

    const existing = await tenantDb().classVoiceRoom.findFirst({
      where: {
        conversationId: conversation.id,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      await upsertParticipant({ tenantId: user.tenantId, roomId: existing.id, user, peerId: input.peerId });
      await createRoomSignal({
        tenantId: user.tenantId,
        roomId: existing.id,
        fromPeerId: input.peerId,
        type: "join",
        payload: { peerId: input.peerId, userId: user.id, userName: user.fullName, role: user.role },
      });
      return roomSnapshot(existing.id);
    }

    const room = await db.classVoiceRoom.create({
      data: {
        tenantId: user.tenantId,
        conversationId: conversation.id,
        classId: conversation.classId!,
        roomKey: classVoiceRoomKey(),
        mode: CLASS_VOICE_MODE,
        status: "ACTIVE",
        createdById: user.id,
        createdByName: user.fullName,
        expiresAt: minutesFromNow(CLASS_VOICE_ROOM_TTL_MINUTES),
      },
    });

    await upsertParticipant({ tenantId: user.tenantId, roomId: room.id, user, peerId: input.peerId });
    await createRoomSignal({
      tenantId: user.tenantId,
      roomId: room.id,
      fromPeerId: input.peerId,
      type: "join",
      payload: { peerId: input.peerId, userId: user.id, userName: user.fullName, role: user.role },
    });

    for (const participant of conversation.participants.filter((p) => p.userId !== user.id)) {
      await createInApp({
        tenantId: user.tenantId,
        recipientId: participant.userId,
        title: "Class voice room started",
        body: `${user.fullName} started a disappearing class voice room. It disappears after ${CLASS_VOICE_ROOM_TTL_MINUTES} minutes.`,
        category: "message",
        href: `/messages?open=${conversation.id}`,
      });
    }

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "class_voice.started",
        entityType: "classVoiceRoom",
        entityId: room.id,
        metadata: JSON.stringify({ conversationId: conversation.id, classId: conversation.classId, ttlMinutes: CLASS_VOICE_ROOM_TTL_MINUTES }),
      },
    });

    return roomSnapshot(room.id);
  });
}

export async function joinClassVoiceRoom(user: SessionUser, input: JoinClassVoiceRoomInput) {
  return withTenant(user.tenantId, async () => {
    await cleanupExpiredClassVoiceRooms(user.tenantId);
    const room = await requireActiveRoom(user.tenantId, input.roomKey);
    await requireClassConversation(user.tenantId, room.conversationId);
    await requireConversationParticipant(room.conversationId, user.id);

    await upsertParticipant({ tenantId: user.tenantId, roomId: room.id, user, peerId: input.peerId });
    await createRoomSignal({
      tenantId: user.tenantId,
      roomId: room.id,
      fromPeerId: input.peerId,
      type: "join",
      payload: { peerId: input.peerId, userId: user.id, userName: user.fullName, role: user.role },
    });

    return roomSnapshot(room.id);
  });
}

export async function postClassVoiceSignal(user: SessionUser, input: PostClassVoiceSignalInput) {
  return withTenant(user.tenantId, async () => {
    const room = await requireActiveRoom(user.tenantId, input.roomKey);
    await requireClassConversation(user.tenantId, room.conversationId);
    await requireConversationParticipant(room.conversationId, user.id);

    const participant = await db.classVoiceParticipant.findFirst({
      where: { tenantId: user.tenantId, roomId: room.id, userId: user.id, peerId: input.fromPeerId, leftAt: null },
    });
    if (!participant) {
      throw new ClassVoiceError("FORBIDDEN", "Join the class voice room before sending voice connection signals.");
    }

    await db.classVoiceParticipant.update({ where: { id: participant.id }, data: { lastSeenAt: new Date() } });
    const signal = await createRoomSignal({
      tenantId: user.tenantId,
      roomId: room.id,
      fromPeerId: input.fromPeerId,
      toPeerId: input.toPeerId,
      type: input.type,
      payload: input.payload,
    });
    return { id: signal.id };
  });
}

export async function pollClassVoiceSignals(user: SessionUser, input: PollClassVoiceSignalsInput) {
  return withTenant(user.tenantId, async () => {
    await cleanupExpiredClassVoiceRooms(user.tenantId);
    const room = await requireActiveRoom(user.tenantId, input.roomKey);
    await requireClassConversation(user.tenantId, room.conversationId);
    await requireConversationParticipant(room.conversationId, user.id);

    const participant = await db.classVoiceParticipant.findFirst({
      where: { tenantId: user.tenantId, roomId: room.id, userId: user.id, peerId: input.peerId, leftAt: null },
    });
    if (!participant) {
      throw new ClassVoiceError("FORBIDDEN", "Join the class voice room before listening for voice connection signals.");
    }
    await db.classVoiceParticipant.update({ where: { id: participant.id }, data: { lastSeenAt: new Date() } });

    const [participants, signals] = await Promise.all([
      db.classVoiceParticipant.findMany({ where: { roomId: room.id, leftAt: null }, orderBy: { joinedAt: "asc" } }),
      db.classVoiceSignal.findMany({
        where: {
          tenantId: user.tenantId,
          roomId: room.id,
          expiresAt: { gt: new Date() },
          OR: [{ toPeerId: input.peerId }, { toPeerId: null }],
          NOT: { fromPeerId: input.peerId },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
    ]);

    const filtered = input.sinceId ? signals.filter((signal) => signal.id > input.sinceId!) : signals;
    return {
      room,
      participants,
      signals: filtered.map((signal) => ({ ...signal, payload: parsePayload(signal.payload) })),
    };
  });
}

export async function endClassVoiceRoom(user: SessionUser, input: { roomKey: string }) {
  return withTenant(user.tenantId, async () => {
    const room = await requireActiveRoom(user.tenantId, input.roomKey);
    await requireClassConversation(user.tenantId, room.conversationId);
    await requireConversationParticipant(room.conversationId, user.id);
    if (!canEndRoom(user, room)) {
      throw new ClassVoiceError("FORBIDDEN", "Only the person who started the room or school leadership can end it for everyone.");
    }

    const ended = await db.classVoiceRoom.update({
      where: { id: room.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
    await db.classVoiceParticipant.updateMany({ where: { roomId: room.id, leftAt: null }, data: { leftAt: new Date() } });
    await createRoomSignal({
      tenantId: user.tenantId,
      roomId: room.id,
      fromPeerId: `system_${user.id}`,
      type: "control",
      payload: { status: "ENDED", endedBy: user.fullName },
    });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "class_voice.ended",
        entityType: "classVoiceRoom",
        entityId: room.id,
        metadata: JSON.stringify({ conversationId: room.conversationId, classId: room.classId }),
      },
    });
    return ended;
  });
}
